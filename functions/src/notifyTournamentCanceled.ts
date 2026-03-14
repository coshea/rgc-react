import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";

const CANCELED_STATUS = "Canceled";
const TTL_DAYS = 60;

interface TournamentData {
  title?: string;
  tee?: string;
  status?: string;
}

interface RegistrationMember {
  id: string;
  displayName?: string;
}

interface RegistrationData {
  team?: RegistrationMember[];
}

interface UserPrefsData {
  notificationPreferences?: {
    tournamentUpdates?: boolean;
  };
}

/**
 * Firestore onUpdate trigger: when a tournament's status changes to "Canceled",
 * fetch all registrations, collect every unique member UID, check their
 * tournamentUpdates preference, and send one notification per eligible member.
 *
 * The existing dispatch_push_notification trigger delivers web-push
 * automatically for each new /notifications/ document.
 */
export const notify_tournament_canceled = onDocumentUpdated(
  "tournaments/{tournamentId}",
  async (event) => {
    const before = event.data?.before.data() as TournamentData | undefined;
    const after = event.data?.after.data() as TournamentData | undefined;

    // Only fire on the transition to Canceled, not on every update
    if (before?.status === CANCELED_STATUS) return;
    if (after?.status !== CANCELED_STATUS) return;

    const { tournamentId } = event.params;
    const db = admin.firestore();

    const tournamentTitle = after.title ?? "Tournament";

    // --- Fetch all registrations ---
    const regsSnap = await db
      .collection(`tournaments/${tournamentId}/registrations`)
      .get();

    if (regsSnap.empty) {
      logger.info(
        `[notify_tournament_canceled] No registrations for ${tournamentId}, skipping.`,
      );
      return;
    }

    // Collect all unique member UIDs across all teams
    const uidSet = new Set<string>();
    for (const regDoc of regsSnap.docs) {
      const { team } = regDoc.data() as RegistrationData;
      if (Array.isArray(team)) {
        team.forEach((m) => {
          if (m.id) uidSet.add(m.id);
        });
      }
    }

    if (uidSet.size === 0) return;

    const uids = Array.from(uidSet);

    // --- Check tournamentUpdates preference for each member in parallel ---
    const prefSnaps = await Promise.all(
      uids.map((uid) => db.doc(`users/${uid}`).get()),
    );

    const eligibleUids = uids.filter((_, i) => {
      const data = prefSnaps[i].data() as UserPrefsData | undefined;
      // Default is true — only skip if explicitly set to false
      return data?.notificationPreferences?.tournamentUpdates !== false;
    });

    if (eligibleUids.length === 0) {
      logger.info(
        `[notify_tournament_canceled] All registered members opted out for ${tournamentId}`,
      );
      return;
    }

    // --- Build notification ---
    const notifTitle = `Tournament Canceled: ${tournamentTitle}`;
    const notifBody = "This tournament has been canceled.";

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);
    const link = `/tournaments/${tournamentId}`;

    // Batch supports up to 500 ops; split if more than 499 members
    let batch = db.batch();
    let count = 0;

    for (const uid of eligibleUids) {
      const ref = db.collection("notifications").doc();
      batch.set(ref, {
        uid,
        title: notifTitle,
        body: notifBody,
        type: "tournament",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
        data: { tournamentId, link },
      });
      count++;
      if (count % 499 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 499 !== 0) {
      await batch.commit();
    }

    logger.info(
      `[notify_tournament_canceled] Sent ${eligibleUids.length} notifications` +
        ` for canceled tournament ${tournamentId}`,
    );
  },
);
