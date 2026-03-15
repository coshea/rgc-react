import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";

interface SendNotificationData {
  title: string;
  body: string;
  type: "announcement" | "tournament" | "new_features" | "tournament_canceled";
  /** Target user's UID. If omitted, broadcasts to all non-migrated members. */
  targetUid?: string;
  /** Target all registrants of a specific tournament instead of a single user or all members. */
  targetTournamentId?: string;
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
  const { title, body, type, targetUid, targetTournamentId, data } =
    request.data as SendNotificationData;

  if (!title?.trim() || !body?.trim()) {
    throw new HttpsError("invalid-argument", "title and body are required.");
  }

  const validTypes = [
    "announcement",
    "tournament",
    "new_features",
    "tournament_canceled",
  ];
  if (!validTypes.includes(type)) {
    throw new HttpsError("invalid-argument", "Invalid notification type.");
  }

  // 4. Build notification doc payload (common fields)
  const TTL_DAYS = 60;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

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
    // Single-user notification
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
    // Send to all registrants of a specific tournament
    const regsSnap = await db
      .collection(`tournaments/${targetTournamentId}/registrations`)
      .get();

    const uidSet = new Set<string>();
    for (const regDoc of regsSnap.docs) {
      const team = regDoc.data().team;
      if (Array.isArray(team)) {
        team.forEach((m: { id?: string }) => {
          if (m.id) uidSet.add(m.id);
        });
      }
    }

    const uids = Array.from(uidSet);
    if (uids.length === 0) return { success: true, count: 0 };

    const BATCH_SIZE = 499;
    let count = 0;
    let batch = db.batch();

    for (const uid of uids) {
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

  // Broadcast — create one notification doc per non-migrated user
  const usersSnap = await db
    .collection("users")
    .where("isMigrated", "!=", true)
    .get();

  if (usersSnap.empty) {
    return { success: true, count: 0 };
  }

  // Firestore batch writes are capped at 500 operations
  const BATCH_SIZE = 499;
  let count = 0;
  let batch = db.batch();

  for (const userDoc of usersSnap.docs) {
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
