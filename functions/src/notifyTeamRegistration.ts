import * as admin from "firebase-admin";
import {
  onDocumentCreated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";

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
}

interface UserPrefsData {
  notificationPreferences?: {
    tournamentRegistration?: boolean;
    tournamentUpdates?: boolean;
  };
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
  "tournaments/{tournamentId}/registrations/{registrationId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { ownerId, team } = snap.data() as RegistrationData;

    // Only notify when there are members beyond the leader
    if (!ownerId || !Array.isArray(team) || team.length < 2) return;

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

    // --- Identify leader ---
    const leader = team.find((m) => m.id === ownerId);
    const leaderName = leader?.displayName?.trim() || "Your team leader";

    // --- Members to notify ---
    const membersToNotify = team.filter((m) => m.id !== ownerId);
    if (membersToNotify.length === 0) return;

    // --- Fetch each member's notification preferences in parallel ---
    const prefSnaps = await Promise.all(
      membersToNotify.map((m) => db.doc(`users/${m.id}`).get()),
    );

    const eligibleMembers = membersToNotify.filter((_, i) => {
      const data = prefSnaps[i].data() as UserPrefsData | undefined;
      // Default is true — only skip if explicitly set to false
      return data?.notificationPreferences?.tournamentRegistration !== false;
    });

    if (eligibleMembers.length === 0) {
      logger.info(
        `[notify_team_registration] All members have opted out for tournament ${tournamentId}`,
      );
      return;
    }

    // --- Build notification payload ---
    const notifTitle = `Registered: ${tournamentTitle}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

    const link = `/tournaments/${tournamentId}`;

    // --- Batch-write one notification per eligible member ---
    const batch = db.batch();
    for (const member of eligibleMembers) {
      const goldTeeStr = member.goldTee ? " · Gold tees" : "";
      const notifBody = `${leaderName} added you to their team.${goldTeeStr}`;
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
    await batch.commit();

    logger.info(
      `[notify_team_registration] Sent ${eligibleMembers.length} notifications` +
        ` for tournament ${tournamentId} (registration ${event.params.registrationId})`,
    );
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
      const data = prefSnaps[i].data() as UserPrefsData | undefined;
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
