import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import webpush, { WebPushError, type PushSubscription } from "web-push";
import { logger } from "./logger";

export const WEB_PUSH_VAPID_PUBLIC_KEY = defineSecret(
  "WEB_PUSH_VAPID_PUBLIC_KEY",
);
export const WEB_PUSH_VAPID_PRIVATE_KEY = defineSecret(
  "WEB_PUSH_VAPID_PRIVATE_KEY",
);

const SITE_ORIGIN = "https://ridgefieldgolfclub.org";
const VAPID_SUBJECT = SITE_ORIGIN;
/** Undelivered pushes expire after 3 days rather than arriving weeks late. */
export const PUSH_TTL_SECONDS = 60 * 60 * 24 * 3;

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

const STALE_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export function isStaleTokenErrorCode(code: string | undefined): boolean {
  return typeof code === "string" && STALE_TOKEN_ERROR_CODES.has(code);
}

/** Push services answer 404/410 once a subscription has been revoked or expired. */
export function isStaleSubscriptionStatus(
  statusCode: number | undefined,
): boolean {
  return statusCode === 404 || statusCode === 410;
}

/** Resolves a stored link (relative or absolute) to an absolute site URL. */
export function toAbsoluteUrl(link: string | undefined): string {
  if (!link) return `${SITE_ORIGIN}/`;
  try {
    return new URL(link, SITE_ORIGIN).href;
  } catch {
    return `${SITE_ORIGIN}/`;
  }
}

/**
 * Web Push `Topic` header lets the push service collapse duplicate sends.
 * It must be at most 32 URL-safe base64 characters.
 */
export function toPushTopic(notificationId: string): string | undefined {
  return /^[A-Za-z0-9_-]{1,32}$/.test(notificationId)
    ? notificationId
    : undefined;
}

/**
 * Declarative Web Push payload (https://webkit.org/blog/16535/).
 *
 * Safari 18.4+ displays this notification itself without running the service
 * worker, so a cold or failing worker can never swallow a push. Browsers
 * without declarative support deliver the same JSON to the service worker's
 * `push` handler, which renders it from the same fields.
 */
export function buildDeclarativePushPayload(
  notificationId: string,
  notification: StoredNotification,
  badgeCount: number,
) {
  const { title, body, data } = notification;
  const navigate = toAbsoluteUrl(data?.link);

  return {
    web_push: 8030,
    notification: {
      title,
      body: body ?? "",
      lang: "en-US",
      dir: "ltr",
      navigate,
      tag: notificationId,
      silent: false,
      ...(badgeCount > 0 ? { app_badge: String(badgeCount) } : {}),
      data: {
        notificationId,
        link: navigate,
        ...(data?.tournamentId ? { tournamentId: data.tournamentId } : {}),
      },
    },
  };
}

/**
 * Legacy FCM payload for devices that still hold an FCM token. They are
 * migrated to a direct Web Push subscription the next time they open the app.
 */
export function buildPushNotificationMessage(
  notificationId: string,
  tokens: string[],
  notification: StoredNotification,
  badgeCount = 0,
): admin.messaging.MulticastMessage {
  const { title, body, data } = notification;

  return {
    tokens,
    // Data-only payload: the service worker always renders exactly one
    // notification from these fields.
    data: {
      notificationId,
      title,
      body: body ?? "",
      ...(badgeCount > 0 ? { badge: String(badgeCount) } : {}),
      ...(data?.link ? { link: data.link } : {}),
      ...(data?.tournamentId ? { tournamentId: data.tournamentId } : {}),
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: String(PUSH_TTL_SECONDS),
      },
      ...(data?.link ? { fcmOptions: { link: data.link } } : {}),
    },
  };
}

function isPushSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  return (
    typeof candidate.endpoint === "string" &&
    typeof candidate.keys?.p256dh === "string" &&
    typeof candidate.keys?.auth === "string"
  );
}

async function countUnread(uid: string): Promise<number> {
  try {
    const snap = await admin
      .firestore()
      .collection("notifications")
      .where("uid", "==", uid)
      .where("read", "==", false)
      .count()
      .get();
    return snap.data().count;
  } catch (err) {
    // The badge is cosmetic; never block delivery on it.
    logger.warn("dispatch_push_notification: unread count failed", {
      uid,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

async function sendWebPush(
  uid: string,
  notificationId: string,
  notification: StoredNotification,
  badgeCount: number,
): Promise<void> {
  const subsSnap = await admin
    .firestore()
    .collection(`users/${uid}/pushSubscriptions`)
    .get();
  if (subsSnap.empty) return;

  const payload = JSON.stringify(
    buildDeclarativePushPayload(notificationId, notification, badgeCount),
  );
  const topic = toPushTopic(notificationId);
  const vapidDetails = {
    subject: VAPID_SUBJECT,
    publicKey: WEB_PUSH_VAPID_PUBLIC_KEY.value(),
    privateKey: WEB_PUSH_VAPID_PRIVATE_KEY.value(),
  };

  const results = await Promise.all(
    subsSnap.docs.map(async (subDoc) => {
      const subscription = subDoc.data();
      if (!isPushSubscription(subscription)) {
        return { id: subDoc.id, ok: false, stale: true, status: undefined };
      }
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          payload,
          {
            vapidDetails,
            TTL: PUSH_TTL_SECONDS,
            urgency: "high",
            ...(topic ? { topic } : {}),
          },
        );
        return { id: subDoc.id, ok: true, stale: false, status: 201 };
      } catch (err) {
        const status = err instanceof WebPushError ? err.statusCode : undefined;
        return {
          id: subDoc.id,
          ok: false,
          stale: isStaleSubscriptionStatus(status),
          status,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  const failures = results.filter((r) => !r.ok);
  logger.info("dispatch_push_notification: web push sent", {
    notificationId,
    uid,
    successCount: results.length - failures.length,
    failureCount: failures.length,
  });
  if (failures.length > 0) {
    logger.warn("dispatch_push_notification: web push failures", {
      notificationId,
      uid,
      failures,
    });
  }

  const staleIds = results.filter((r) => r.stale).map((r) => r.id);
  if (staleIds.length > 0) {
    const batch = admin.firestore().batch();
    staleIds.forEach((id) => {
      batch.delete(
        admin.firestore().doc(`users/${uid}/pushSubscriptions/${id}`),
      );
    });
    await batch.commit();
    logger.info("dispatch_push_notification: removed stale subscriptions", {
      uid,
      count: staleIds.length,
    });
  }
}

async function sendLegacyFcm(
  uid: string,
  notificationId: string,
  notification: StoredNotification,
  badgeCount: number,
): Promise<void> {
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
    notificationId,
    tokens,
    notification,
    badgeCount,
  );

  const response = await admin.messaging().sendEachForMulticast(message);

  logger.info("dispatch_push_notification: legacy fcm sent", {
    notificationId,
    uid,
    successCount: response.successCount,
    failureCount: response.failureCount,
  });

  const failures = response.responses.flatMap((result, index) => {
    if (result.success) return [];
    return [
      {
        tokenDocId: tokenDocs[index]?.id,
        code: result.error?.code ?? "unknown",
        message: result.error?.message ?? "Unknown messaging error",
      },
    ];
  });

  if (failures.length > 0) {
    logger.warn("dispatch_push_notification: legacy fcm failures", {
      notificationId,
      uid,
      failures,
    });
  }

  // Remove stale tokens so they don't accumulate
  const staleDocIds: string[] = [];
  response.responses.forEach((r, i) => {
    if (!r.success && isStaleTokenErrorCode(r.error?.code)) {
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
}

/**
 * Firestore trigger: fires whenever a new notification document is created under
 * /notifications/{notificationId}.
 *
 * Delivers to every device the user has registered: direct Web Push
 * subscriptions (users/{uid}/pushSubscriptions) and, during the migration
 * window, legacy FCM tokens (users/{uid}/fcmTokens). Stale entries are removed.
 */
export const dispatch_push_notification = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    secrets: [WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data() as StoredNotification;
    const { uid, title } = notification;
    const notificationId = event.params.notificationId;

    if (!uid || !title) {
      logger.warn(
        "dispatch_push_notification: missing uid or title, skipping",
        { notificationId },
      );
      return;
    }

    const badgeCount = await countUnread(uid);

    // Run both channels independently so a failure in one never blocks the other.
    const results = await Promise.allSettled([
      sendWebPush(uid, notificationId, notification, badgeCount),
      sendLegacyFcm(uid, notificationId, notification, badgeCount),
    ]);

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error("dispatch_push_notification: channel failed", {
          notificationId,
          uid,
          channel: index === 0 ? "web-push" : "fcm",
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });
  },
);
