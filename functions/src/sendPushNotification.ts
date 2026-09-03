import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "./logger";

interface PushNotificationData {
  link?: string;
  tournamentId?: string;
}

interface StoredNotification {
  uid: string;
  title: string;
  body: string;
  data?: PushNotificationData;
}

export function buildPushNotificationMessage(
  notificationId: string,
  tokens: string[],
  notification: StoredNotification,
): admin.messaging.MulticastMessage {
  const { title, body, data } = notification;

  return {
    tokens,
    // Data-only payload for web clients. The service worker renders exactly one
    // notification, which avoids duplicate OS alerts on iOS Home Screen apps.
    data: {
      notificationId,
      title,
      body: body ?? "",
      ...(data?.link ? { link: data.link } : {}),
      ...(data?.tournamentId ? { tournamentId: data.tournamentId } : {}),
    },
    apns: {
      headers: {
        "apns-collapse-id": notificationId,
      },
    },
    webpush: {
      ...(data?.link ? { fcmOptions: { link: data.link } } : {}),
    },
  };
}

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
    const { uid, title } = notification as StoredNotification;

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

    const message = buildPushNotificationMessage(
      event.params.notificationId,
      tokens,
      notification as StoredNotification,
    );

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
