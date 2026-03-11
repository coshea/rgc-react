import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "./logger";

/**
 * Firestore trigger: fires whenever a new notification document is created under
 * /notifications/{notificationId}.
 *
 * Reads the target user's FCM tokens from users/{uid}/fcmTokens, sends a
 * multicast FCM message, and removes any stale/invalid tokens automatically.
 */
export const dispatch_push_notification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data();
    const { uid, title, body, data } = notification as {
      uid: string;
      title: string;
      body: string;
      data?: { link?: string; tournamentId?: string };
    };

    if (!uid || !title) {
      logger.warn(
        "dispatch_push_notification: missing uid or title, skipping",
        {
          notificationId: event.params.notificationId,
        },
      );
      return;
    }

    // Fetch all registered FCM tokens for this user (multi-device support)
    const tokensSnap = await admin
      .firestore()
      .collection(`users/${uid}/fcmTokens`)
      .get();

    if (tokensSnap.empty) return;

    const tokenDocs = tokensSnap.docs;
    const tokens = tokenDocs
      .map((d) => d.data().token as string | undefined)
      .filter((t): t is string => Boolean(t));

    if (tokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body: body ?? "" },
      webpush: {
        notification: { icon: "/rgc_fav.png" },
        ...(data?.link ? { fcmOptions: { link: data.link } } : {}),
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    logger.info("dispatch_push_notification: sent", {
      notificationId: event.params.notificationId,
      uid,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // Remove stale tokens so they don't accumulate
    const staleDocIds: string[] = [];
    response.responses.forEach((r, i) => {
      if (
        !r.success &&
        r.error?.code === "messaging/registration-token-not-registered"
      ) {
        staleDocIds.push(tokenDocs[i].id);
      }
    });

    if (staleDocIds.length > 0) {
      const batch = admin.firestore().batch();
      staleDocIds.forEach((id) => {
        batch.delete(admin.firestore().doc(`users/${uid}/fcmTokens/${id}`));
      });
      await batch.commit();
      logger.info("dispatch_push_notification: removed stale tokens", {
        uid,
        count: staleDocIds.length,
      });
    }
  },
);
