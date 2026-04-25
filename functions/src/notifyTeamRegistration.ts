import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";
import { RESEND_API_KEY } from "./resendConfig";
import {
  buildTeamMembersHtml,
  sendTournamentLeaderEmail,
  sendTournamentMemberEmail,
} from "./sendRegistrationEmails";

interface RegistrationMember {
  id: string;
  displayName?: string;
  goldTee?: boolean;
}

interface RegistrationData {
  ownerId?: string;
  team?: RegistrationMember[];
}

interface TournamentData {
  title?: string;
  tee?: string;
  date?: admin.firestore.Timestamp;
  assignedTeeTimes?: boolean;
}

interface UserData {
  email?: string;
  firstName?: string;
  displayName?: string;
  notificationPreferences?: {
    tournamentRegistration?: boolean;
    tournamentUpdates?: boolean;
    emailEnabled?: boolean;
    emailTournamentRegistration?: boolean;
  };
}

/**
 * Returns true when the user has not explicitly opted out of registration emails.
 *
 * Opt-out semantics: absent or undefined = eligible (send email).
 * Only a stored value of `false` on the per-type flag blocks the email.
 *
 * NOTE: We intentionally do NOT check `emailEnabled` here. That field had a
 * legacy default of `false`, so any user who saved notification settings before
 * the defaults were corrected has `emailEnabled: false` stored — even if they
 * never intentionally turned emails off. Checking `emailEnabled` would silently
 * exclude those users. Instead, rely solely on the per-type flag which is only
 * set to `false` when the user explicitly opts out via the new email-toggle UI.
 */
function isEmailEligible(data: UserData | undefined): boolean {
  const prefs = data?.notificationPreferences;
  return prefs?.emailTournamentRegistration !== false;
}

/** Returns the first whitespace-separated word of a string, or "". */
function firstWord(str: string | undefined): string {
  if (!str) return "";
  return str.trim().split(/\s+/)[0] || "";
}

const TTL_DAYS = 60;

/**
 * Firestore onCreate trigger: when a new team registration is created for a
 * tournament, send an in-app notification to every team member except the
 * team leader (ownerId). Respects each member's notificationPreferences.
 *
 * The existing dispatch_push_notification trigger picks up each new
 * /notifications/ document automatically and delivers web-push to registered
 * FCM tokens.
 */
export const notify_team_registration = onDocumentCreated(
  {
    document: "tournaments/{tournamentId}/registrations/{registrationId}",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { ownerId, team } = snap.data() as RegistrationData;

    logger.info(
      `[notify_team_registration] Triggered — ownerId=${ownerId}, teamSize=${Array.isArray(team) ? team.length : "N/A"}`,
      {
        registrationId: event.params.registrationId,
        tournamentId: event.params.tournamentId,
      },
    );

    if (!ownerId || !Array.isArray(team) || team.length === 0) {
      logger.warn(
        `[notify_team_registration] Early exit — missing ownerId or empty team`,
        { ownerId, team },
      );
      return;
    }

    const { tournamentId } = event.params;
    const db = admin.firestore();

    // --- Fetch tournament ---
    const tournamentSnap = await db.doc(`tournaments/${tournamentId}`).get();
    if (!tournamentSnap.exists) {
      logger.warn(
        `[notify_team_registration] Tournament ${tournamentId} not found`,
      );
      return;
    }
    const tournament = tournamentSnap.data() as TournamentData;
    const tournamentTitle = tournament.title ?? "Tournament";
    logger.info(
      `[notify_team_registration] Tournament: "${tournamentTitle}" (${tournamentId})`,
    );

    // --- Identify leader ---
    const leader = team.find((m) => m.id === ownerId);
    const leaderDisplayName = leader?.displayName?.trim() || "Your team leader";

    // --- Fetch ALL user docs (for both in-app prefs and email fields) ---
    const userSnaps = await Promise.all(
      team.map((m) => db.doc(`users/${m.id}`).get()),
    );
    const userDataMap = new Map<string, UserData>();
    team.forEach((m, i) => {
      if (userSnaps[i].exists) {
        const data = userSnaps[i].data() as UserData;
        userDataMap.set(m.id, data);
        logger.info(
          `[notify_team_registration] User ${m.id}: email=${data.email ?? "MISSING"}, ` +
            `emailEnabled=${data.notificationPreferences?.emailEnabled}, ` +
            `emailTournamentRegistration=${data.notificationPreferences?.emailTournamentRegistration}, ` +
            `inAppTournamentRegistration=${data.notificationPreferences?.tournamentRegistration}`,
        );
      } else {
        logger.warn(
          `[notify_team_registration] No user doc found for id=${m.id} (${m.displayName})`,
        );
      }
    });

    // --- IN-APP NOTIFICATIONS (existing behaviour: non-leader members only) ---
    const membersToNotify = team.filter((m) => m.id !== ownerId);
    const eligibleForInApp = membersToNotify.filter((m) => {
      const data = userDataMap.get(m.id);
      return data?.notificationPreferences?.tournamentRegistration !== false;
    });

    logger.info(
      `[notify_team_registration] In-app: ${membersToNotify.length} non-leader member(s), ` +
        `${eligibleForInApp.length} eligible for in-app notification`,
    );

    if (eligibleForInApp.length > 0) {
      const notifTitle = `Registered: ${tournamentTitle}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);
      const link = `/tournaments/${tournamentId}`;

      const batch = db.batch();
      for (const member of eligibleForInApp) {
        const goldTeeStr = member.goldTee ? " · Gold tees" : "";
        const notifBody = `${leaderDisplayName} added you to their team.${goldTeeStr}`;
        const ref = db.collection("notifications").doc();
        batch.set(ref, {
          uid: member.id,
          title: notifTitle,
          body: notifBody,
          type: "tournament",
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt,
          data: {
            tournamentId,
            link,
          },
        });
      }
      try {
        await batch.commit();
        logger.info(
          `[notify_team_registration] Sent ${eligibleForInApp.length} in-app notifications` +
            ` for tournament ${tournamentId} (registration ${event.params.registrationId})`,
        );
      } catch (err) {
        logger.error(
          `[notify_team_registration] Failed to write in-app notifications`,
          err,
        );
      }
    }

    // --- EMAIL NOTIFICATIONS ---
    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      logger.warn(
        `[notify_team_registration] RESEND_API_KEY not configured — skipping emails`,
      );
      return;
    }

    const tournamentUrl = `https://ridgefieldgolfclub.org/tournaments/${tournamentId}`;
    const tournamentDate = tournament.date
      ? tournament.date.toDate().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "America/New_York",
        })
      : "Date TBD";
    const tournamentTee = tournament.tee ? `${tournament.tee} tees` : "TBD";
    const tournamentTeeTimes = tournament.assignedTeeTimes
      ? "Assigned"
      : "Get your own";
    const teamMembersHtml = buildTeamMembersHtml(team, ownerId);

    // Leader confirmation email
    const leaderData = userDataMap.get(ownerId);
    const leaderEmail = leaderData?.email;
    logger.info(
      `[notify_team_registration] Leader email check — email=${leaderEmail ?? "MISSING"}, eligible=${isEmailEligible(leaderData)}`,
    );
    if (leaderEmail && isEmailEligible(leaderData)) {
      const firstName =
        leaderData?.firstName ||
        firstWord(leaderData?.displayName) ||
        firstWord(leaderDisplayName) ||
        "there";
      try {
        await sendTournamentLeaderEmail(apiKey, leaderEmail, {
          firstName,
          tournamentTitle,
          tournamentDate,
          tournamentTee,
          tournamentTeeTimes,
          teamMembersHtml,
          tournamentUrl,
        });
        logger.info(
          `[notify_team_registration] Sent leader email to ${leaderEmail}`,
        );
      } catch (err) {
        logger.error(
          `[notify_team_registration] Failed to send leader email`,
          err,
        );
      }
    }

    // Member "you've been added" emails
    for (const member of membersToNotify) {
      const memberData = userDataMap.get(member.id);
      const memberEmail = memberData?.email;
      const eligible = isEmailEligible(memberData);
      logger.info(
        `[notify_team_registration] Member ${member.id} (${member.displayName}) email check — ` +
          `email=${memberEmail ?? "MISSING"}, eligible=${eligible}`,
      );
      if (!memberEmail || !eligible) continue;
      const firstName =
        memberData?.firstName ||
        firstWord(memberData?.displayName) ||
        firstWord(member.displayName) ||
        "there";
      try {
        await sendTournamentMemberEmail(apiKey, memberEmail, {
          firstName,
          leaderName: leaderDisplayName,
          tournamentTitle,
          tournamentDate,
          tournamentTee,
          tournamentTeeTimes,
          teamMembersHtml,
          tournamentUrl,
        });
        logger.info(
          `[notify_team_registration] Sent member email to ${memberEmail}`,
        );
      } catch (err) {
        logger.error(
          `[notify_team_registration] Failed to send member email to ${memberEmail}`,
          err,
        );
      }
    }
  },
);

/**
 * Firestore onDelete trigger: when a team registration is deleted, notify all
 * team members (including the leader, since an admin may have removed the
 * registration on their behalf). Respects tournamentRegistration preference.
 */
export const notify_team_registration_canceled = onDocumentDeleted(
  "tournaments/{tournamentId}/registrations/{registrationId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { ownerId, team } = snap.data() as RegistrationData;
    if (!ownerId || !Array.isArray(team) || team.length === 0) return;

    const { tournamentId } = event.params;
    const db = admin.firestore();

    // --- Fetch tournament ---
    const tournamentSnap = await db.doc(`tournaments/${tournamentId}`).get();
    const tournament = tournamentSnap.exists
      ? (tournamentSnap.data() as TournamentData)
      : null;
    const tournamentTitle = tournament?.title ?? "Tournament";

    // --- Identify leader for body copy ---
    const leader = team.find((m) => m.id === ownerId);
    const leaderName = leader?.displayName?.trim() || "The team leader";

    // --- Fetch preferences for all members in parallel ---
    const prefSnaps = await Promise.all(
      team.map((m) => db.doc(`users/${m.id}`).get()),
    );

    const eligibleMembers = team.filter((_, i) => {
      const data = prefSnaps[i].data() as UserData | undefined;
      return data?.notificationPreferences?.tournamentRegistration !== false;
    });

    if (eligibleMembers.length === 0) return;

    const notifTitle = `Registration Canceled: ${tournamentTitle}`;
    const notifBody = `${leaderName}'s team registration has been removed.`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);
    const link = `/tournaments/${tournamentId}`;

    const batch = db.batch();
    for (const member of eligibleMembers) {
      const ref = db.collection("notifications").doc();
      batch.set(ref, {
        uid: member.id,
        title: notifTitle,
        body: notifBody,
        type: "tournament",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
        data: { tournamentId, link },
      });
    }
    await batch.commit();

    logger.info(
      `[notify_team_registration_canceled] Sent ${eligibleMembers.length} notifications` +
        ` for tournament ${tournamentId} (registration ${event.params.registrationId})`,
    );
  },
);
