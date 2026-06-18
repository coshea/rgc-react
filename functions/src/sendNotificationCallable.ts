import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";
import {
  type NotificationType,
  type UserPrefsData,
  userWantsType,
} from "./notificationPreferences";

interface SendNotificationData {
  title: string;
  body: string;
  type: NotificationType;
  /** Target user's UID. If omitted, broadcasts to all non-migrated members. */
  targetUid?: string;
  /** Target all registrants of a specific tournament instead of a single user or all members. */
  targetTournamentId?: string;
  /**
   * Target all non-migrated members who are NOT registered in this tournament.
   */
  targetNonRegistrantsTournamentId?: string;
  /**
   * When targeting tournament registrants, only notify the first N teams
   * (ordered by registeredAt ascending). Teams beyond this index are
   * considered waitlisted and are excluded. Omit to notify all registrants.
   */
  maxTeams?: number;
  /**
   * Optional ISO 8601 datetime string for the notification expiry.
   * When omitted, defaults to 60 days from now.
   */
  expiresAt?: string;
  data?: {
    link?: string;
    tournamentId?: string;
  };
}

/**
 * Callable Cloud Function for admins to send in-app (and push) notifications.
 *
 * - Single user: pass targetUid.
 * - Broadcast to all members: omit targetUid (admin-only; iterates all non-migrated users).
 *
 * Writing notification docs to Firestore automatically triggers
 * dispatch_push_notification for each doc.
 */
export const send_notification = onCall(async (request) => {
  // 1. Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const callerUid = request.auth.uid;

  // 2. Admin check: accept either custom claim or admin Firestore doc
  const isClaimAdmin = request.auth.token.admin === true;
  let isDocAdmin = false;
  if (!isClaimAdmin) {
    const adminDoc = await admin.firestore().doc(`admin/${callerUid}`).get();
    if (adminDoc.exists) {
      const d = adminDoc.data();
      isDocAdmin =
        d?.isAdmin === true || d?.admin === true || d?.admin === "true";
    }
  }

  if (!isClaimAdmin && !isDocAdmin) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  // 3. Validate payload
  const {
    title,
    body,
    type,
    targetUid,
    targetTournamentId,
    targetNonRegistrantsTournamentId,
    maxTeams,
    expiresAt: expiresAtParam,
    data,
  } = request.data as SendNotificationData;

  if (!title?.trim() || !body?.trim()) {
    throw new HttpsError("invalid-argument", "title and body are required.");
  }

  const validTypes = [
    "announcement",
    "tournament",
    "new_features",
    "tournament_canceled",
    "registration_opening",
    "registration_closing_soon",
  ];
  if (!validTypes.includes(type)) {
    throw new HttpsError("invalid-argument", "Invalid notification type.");
  }

  // 4. Build notification doc payload (common fields)
  const TTL_DAYS = 60;
  let expiresAt: Date;
  if (expiresAtParam) {
    const parsed = new Date(expiresAtParam);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid expiresAt. Expected a valid ISO 8601 datetime string.",
      );
    }
    expiresAt = parsed;
  } else {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);
  }

  const basePayload = {
    title: title.trim(),
    body: body.trim(),
    type,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    ...(data?.link || data?.tournamentId ? { data } : {}),
  };

  const db = admin.firestore();

  if (targetUid) {
    // Check recipient's preferences before writing
    const userSnap = await db.doc(`users/${targetUid}`).get();
    const userPrefs = (userSnap.data() as UserPrefsData | undefined)
      ?.notificationPreferences;
    if (!userWantsType(userPrefs, type)) {
      logger.info("send_notification: skipped — user opted out", {
        callerUid,
        targetUid,
        type,
      });
      return { success: true, count: 0 };
    }

    await db.collection("notifications").add({
      ...basePayload,
      uid: targetUid,
    });

    logger.info("send_notification: created single notification", {
      callerUid,
      targetUid,
      type,
    });

    return { success: true, count: 1 };
  }

  if (targetTournamentId) {
    // Send to registrants of a specific tournament.
    // Order by registeredAt so that index-based waitlist exclusion is stable.
    const regsSnap = await db
      .collection(`tournaments/${targetTournamentId}/registrations`)
      .orderBy("registeredAt", "asc")
      .get();

    // When maxTeams is provided, only the first N registrations are "in tournament";
    // the rest are waitlisted and are excluded.
    const regDocs =
      typeof maxTeams === "number" && maxTeams > 0
        ? regsSnap.docs.slice(0, maxTeams)
        : regsSnap.docs;

    const uidSet = new Set<string>();
    for (const regDoc of regDocs) {
      const team = regDoc.data().team;
      if (Array.isArray(team)) {
        team.forEach((m: { id?: string }) => {
          if (m.id) uidSet.add(m.id);
        });
      }
    }

    const uids = Array.from(uidSet);
    if (uids.length === 0) return { success: true, count: 0 };

    // Filter by each registrant's notification preferences
    const prefSnaps = await Promise.all(
      uids.map((uid) => db.doc(`users/${uid}`).get()),
    );
    const eligibleUids = uids.filter((_, i) => {
      const prefs = (prefSnaps[i].data() as UserPrefsData | undefined)
        ?.notificationPreferences;
      return userWantsType(prefs, type);
    });

    if (eligibleUids.length === 0) {
      logger.info("send_notification: all tournament registrants opted out", {
        callerUid,
        targetTournamentId,
        type,
      });
      return { success: true, count: 0 };
    }

    const BATCH_SIZE = 499;
    let count = 0;
    let batch = db.batch();

    for (const uid of eligibleUids) {
      const ref = db.collection("notifications").doc();
      batch.set(ref, { ...basePayload, uid });
      count++;
      if (count % BATCH_SIZE === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % BATCH_SIZE !== 0) {
      await batch.commit();
    }

    logger.info("send_notification: tournament registrant broadcast complete", {
      callerUid,
      targetTournamentId,
      count,
      type,
    });

    return { success: true, count };
  }

  if (targetNonRegistrantsTournamentId) {
    // Collect all UIDs registered in the tournament.
    const regsSnap = await db
      .collection(
        `tournaments/${targetNonRegistrantsTournamentId}/registrations`,
      )
      .get();
    const registeredUids = new Set<string>();
    for (const regDoc of regsSnap.docs) {
      const team = regDoc.data().team;
      if (Array.isArray(team)) {
        team.forEach((m: { id?: string }) => {
          if (m.id) registeredUids.add(m.id);
        });
      }
    }

    // Stream all users sequentially to avoid loading the full collection
    // into memory. Filter isMigrated and registeredUids inline.
    const BATCH_SIZE = 499;
    let count = 0;
    let batch = db.batch();

    const userStream = db.collection("users").stream() as unknown as AsyncIterable<admin.firestore.QueryDocumentSnapshot>;
    for await (const userDoc of userStream) {
      const data = userDoc.data();
      if (data.isMigrated === true || registeredUids.has(userDoc.id)) continue;
      const prefs = (data as UserPrefsData)?.notificationPreferences;
      if (!userWantsType(prefs, type)) continue;

      const ref = db.collection("notifications").doc();
      batch.set(ref, { ...basePayload, uid: userDoc.id });
      count++;
      if (count % BATCH_SIZE === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % BATCH_SIZE !== 0) {
      await batch.commit();
    }

    if (count === 0) {
      logger.info("send_notification: no non-registrants to notify", {
        callerUid,
        targetNonRegistrantsTournamentId,
        type,
      });
    }

    logger.info("send_notification: non-registrant broadcast complete", {
      callerUid,
      targetNonRegistrantsTournamentId,
      count,
      type,
    });

    return { success: true, count };
  }

  // Broadcast — stream users sequentially to avoid loading the full collection
  // into memory. Firestore's `!=` operator excludes docs where isMigrated is
  // absent, so we filter in-stream to include users who never had isMigrated set.
  // Firestore batch writes are capped at 500 operations.
  const BATCH_SIZE = 499;
  let count = 0;
  let batch = db.batch();

  const userStream = db.collection("users").stream() as unknown as AsyncIterable<admin.firestore.QueryDocumentSnapshot>;
  for await (const userDoc of userStream) {
    const data = userDoc.data();
    if (data.isMigrated === true) continue;
    const prefs = (data as UserPrefsData)?.notificationPreferences;
    if (!userWantsType(prefs, type)) continue;

    const ref = db.collection("notifications").doc();
    batch.set(ref, { ...basePayload, uid: userDoc.id });
    count++;

    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  logger.info("send_notification: broadcast complete", {
    callerUid,
    count,
    type,
  });

  return { success: true, count };
});
