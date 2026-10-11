import { useEffect, useState, useCallback } from "react";
import * as Sentry from "@sentry/react";
import { db } from "@/config/firebase";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as
  | string
  | undefined;
/** Kept for continuity with existing installs; see the worker file header. */
const SERVICE_WORKER_URL = "/firebase-messaging-sw.js";
const DISMISSED_KEY = "rgc_notif_prompt_dismissed";
/** localStorage key storing the push subscription doc ID for this device. */
export const PUSH_SUBSCRIPTION_ID_KEY = "rgc_push_subscription_id";
const PUSH_SUBSCRIPTION_REFRESHED_AT_KEY = "rgc_push_subscription_refreshed_at";
/** Pre-migration FCM token doc ID; removed once this device migrates. */
export const LEGACY_FCM_TOKEN_ID_KEY = "rgc_fcm_token_id";
const LEGACY_FCM_TOKEN_REFRESHED_AT_KEY = "rgc_fcm_token_refreshed_at";
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;
const WORKER_SUBSCRIBE_TIMEOUT_MS = 10_000;

export interface UsePushSubscriptionReturn {
  /** True when permission is 'default' and the user hasn't dismissed the prompt. */
  shouldPrompt: boolean;
  /**
   * True when permission is granted but the browser refused to create a
   * subscription without a user gesture (seen on iOS). A tap on a button that
   * calls requestPermission() completes it.
   */
  needsResubscribe: boolean;
  /** True when this specific browser/device has a registered push subscription. */
  isPushEnabledOnDevice: boolean;
  /** Call from a user gesture: asks for permission (if needed) and subscribes. */
  requestPermission: () => Promise<void>;
  /** Call this when the user clicks "Not now" — hides the prompt permanently. */
  dismissPrompt: () => void;
}

type SyncResult =
  | { status: "ok"; id: string }
  | { status: "subscribe-failed" }
  | { status: "error" };

/** True when this browser can receive Web Push and the app is configured for it. */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "PushManager" in window &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    !!VAPID_PUBLIC_KEY
  );
}

/**
 * Manages Web Push permission and the device's push subscription.
 *
 * Does NOT call Notification.requestPermission() automatically — instead it
 * returns shouldPrompt + requestPermission so a custom UI can drive the flow.
 * Once granted, stores the subscription in Firestore under
 * users/{uid}/pushSubscriptions/{id} for multi-device support, where the
 * dispatch_push_notification Cloud Function sends to it directly.
 */
export function usePushSubscription(
  uid: string | null,
): UsePushSubscriptionReturn {
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const [needsResubscribe, setNeedsResubscribe] = useState(false);
  const [isPushEnabledOnDevice, setIsPushEnabledOnDevice] = useState(false);

  useEffect(() => {
    if (!uid || !isPushSupported()) {
      setIsPushEnabledOnDevice(false);
      setShouldPrompt(false);
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const refresh = (force = false) => {
      if (Notification.permission !== "granted" || inFlight) return;
      inFlight = true;
      void syncSubscription(uid, { force, userGesture: false })
        .then((result) => {
          if (cancelled) return;
          applyResult(result, setIsPushEnabledOnDevice, setNeedsResubscribe);
        })
        .finally(() => {
          inFlight = false;
        });
    };

    const permission = Notification.permission;
    if (permission === "granted") {
      setIsPushEnabledOnDevice(!!localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY));
      // Always re-sync on launch: this migrates legacy FCM installs and picks
      // up endpoints rotated while the app was closed.
      refresh(true);
    } else if (permission === "default" && !localStorage.getItem(DISMISSED_KEY)) {
      setIsPushEnabledOnDevice(false);
      setShouldPrompt(true);
    } else {
      // "denied" — nothing we can do, don't bother the user.
      setIsPushEnabledOnDevice(false);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handleResume = () => refresh();
    const handleControllerChange = () => refresh(true);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    window.addEventListener("online", handleResume);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("pageshow", handleResume);
      window.removeEventListener("online", handleResume);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, [uid]);

  const requestPermission = useCallback(async () => {
    if (!uid || !isPushSupported()) return;
    setShouldPrompt(false);
    // Clear any previous dismissal so the user can always re-enable from Settings
    localStorage.removeItem(DISMISSED_KEY);
    try {
      // Request permission before any other await: iOS only shows the
      // permission sheet while the user gesture is still active.
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setIsPushEnabledOnDevice(false);
        return;
      }
      const result = await syncSubscription(uid, {
        force: true,
        userGesture: true,
      });
      applyResult(result, setIsPushEnabledOnDevice, setNeedsResubscribe);
    } catch (err) {
      Sentry.captureException(err);
      console.warn("[Push] Permission request failed:", err);
    }
  }, [uid]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShouldPrompt(false);
    setNeedsResubscribe(false);
  }, []);

  return {
    shouldPrompt,
    needsResubscribe,
    isPushEnabledOnDevice,
    requestPermission,
    dismissPrompt,
  };
}

function applyResult(
  result: SyncResult,
  setEnabled: (value: boolean) => void,
  setNeedsResubscribe: (value: boolean) => void,
): void {
  if (result.status === "ok") {
    setEnabled(true);
    setNeedsResubscribe(false);
  } else if (result.status === "subscribe-failed") {
    setEnabled(false);
    setNeedsResubscribe(true);
  }
  // "error" (e.g. offline Firestore write): keep the current state and retry
  // on the next resume.
}

// ---------------------------------------------------------------------------
// Subscription plumbing
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function keysEqual(buffer: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!buffer) return false;
  const actual = new Uint8Array(buffer);
  return (
    actual.length === expected.length &&
    actual.every((byte, i) => byte === expected[i])
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // Register (idempotent), then use the *active* registration from `ready`.
  // During a worker update `register()` can return a registration whose
  // `.active` is null; `ready` always resolves with the active one.
  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  return navigator.serviceWorker.ready;
}

/** Subscribes from the page. Needs a user gesture on iOS. */
async function subscribeInPage(
  registration: ServiceWorkerRegistration,
  key: string,
): Promise<PushSubscriptionJSON> {
  const applicationServerKey = urlBase64ToUint8Array(key);
  const existing = await registration.pushManager.getSubscription();
  if (
    existing &&
    keysEqual(existing.options.applicationServerKey, applicationServerKey)
  ) {
    return existing.toJSON();
  }
  if (existing) await existing.unsubscribe();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  return subscription.toJSON();
}

/**
 * Asks the service worker to subscribe. Workers can subscribe without a user
 * gesture once permission is granted, so this migrates legacy installs silently.
 */
function subscribeViaWorker(
  registration: ServiceWorkerRegistration,
  key: string,
): Promise<PushSubscriptionJSON> {
  const worker = registration.active;
  if (!worker || typeof MessageChannel === "undefined") {
    return Promise.reject(new Error("No active service worker"));
  }
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error("Service worker subscribe timed out"));
    }, WORKER_SUBSCRIBE_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      channel.port1.close();
      const reply = event.data as
        | { ok: true; subscription: PushSubscriptionJSON }
        | { ok: false; error?: string };
      if (reply?.ok) resolve(reply.subscription);
      else reject(new Error(reply?.error ?? "Service worker subscribe failed"));
    };
    worker.postMessage(
      { type: "PUSH_SUBSCRIBE", applicationServerKey: key },
      [channel.port2],
    );
  });
}

async function obtainSubscription(
  registration: ServiceWorkerRegistration,
  key: string,
  userGesture: boolean,
): Promise<PushSubscriptionJSON | null> {
  // Fast path: an existing subscription with the current key needs no work.
  const existing = await registration.pushManager.getSubscription();
  if (
    existing &&
    keysEqual(existing.options.applicationServerKey, urlBase64ToUint8Array(key))
  ) {
    return existing.toJSON();
  }

  // With a gesture the page can subscribe directly; without one, the worker
  // is the only path that works everywhere (notably iOS).
  const attempts = userGesture
    ? [subscribeInPage, subscribeViaWorker]
    : [subscribeViaWorker, subscribeInPage];

  for (const attempt of attempts) {
    try {
      return await attempt(registration, key);
    } catch (err) {
      console.warn("[Push] Subscribe attempt failed:", err);
    }
  }
  return null;
}

/**
 * Stable, Firestore-safe doc ID for an endpoint. Endpoints share long common
 * prefixes, so a hash is used instead of truncation. Not security-relevant:
 * docs live under the owner's own path.
 */
export function subscriptionDocId(endpoint: string): string {
  const hash = (seed: number) => {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < endpoint.length; i += 1) {
      const ch = endpoint.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 =
      Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
      Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 =
      Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
      Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (
      (h2 >>> 0).toString(16).padStart(8, "0") +
      (h1 >>> 0).toString(16).padStart(8, "0")
    );
  };
  return hash(1) + hash(2);
}

function isStandaloneDisplay(): boolean {
  return (
    (window.matchMedia?.("(display-mode: standalone)").matches ?? false) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function removeLegacyFcmToken(uid: string): Promise<void> {
  const legacyId = localStorage.getItem(LEGACY_FCM_TOKEN_ID_KEY);
  if (!legacyId) return;
  try {
    await deleteDoc(doc(db, "users", uid, "fcmTokens", legacyId));
  } catch {
    // Best-effort: the server prunes the dead token on its next send anyway.
  }
  localStorage.removeItem(LEGACY_FCM_TOKEN_ID_KEY);
  localStorage.removeItem(LEGACY_FCM_TOKEN_REFRESHED_AT_KEY);
}

async function syncSubscription(
  uid: string,
  options: { force: boolean; userGesture: boolean },
): Promise<SyncResult> {
  if (!VAPID_PUBLIC_KEY) return { status: "error" };

  let subscription: PushSubscriptionJSON | null;
  try {
    const registration = await getRegistration();
    subscription = await obtainSubscription(
      registration,
      VAPID_PUBLIC_KEY,
      options.userGesture,
    );
  } catch (err) {
    Sentry.captureException(err);
    return { status: "error" };
  }

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    Sentry.captureMessage("Push subscription could not be created", {
      level: "warning",
      tags: { push_user_gesture: String(options.userGesture) },
    });
    return { status: "subscribe-failed" };
  }

  const id = subscriptionDocId(endpoint);
  const previousId = localStorage.getItem(PUSH_SUBSCRIPTION_ID_KEY);
  const lastRefreshedAt = Number.parseInt(
    localStorage.getItem(PUSH_SUBSCRIPTION_REFRESHED_AT_KEY) ?? "",
    10,
  );
  const refreshExpired =
    !Number.isFinite(lastRefreshedAt) ||
    Date.now() - lastRefreshedAt >= REFRESH_INTERVAL_MS;

  if (!options.force && previousId === id && !refreshExpired) {
    return { status: "ok", id };
  }

  try {
    await Sentry.startSpan(
      { name: "Save push subscription", op: "db.write" },
      async () => {
        await setDoc(
          doc(db, "users", uid, "pushSubscriptions", id),
          {
            endpoint,
            keys: { p256dh, auth },
            lastSeenAt: serverTimestamp(),
            userAgent: navigator.userAgent.slice(0, 256),
            standalone: isStandaloneDisplay(),
            // createdAt is only written the first time this device stores
            // this endpoint; later refreshes merge lastSeenAt only.
            ...(previousId !== id ? { createdAt: serverTimestamp() } : {}),
          },
          { merge: true },
        );
      },
    );
  } catch (err) {
    Sentry.captureException(err);
    console.warn("[Push] Saving subscription failed:", err);
    return { status: "error" };
  }

  localStorage.setItem(PUSH_SUBSCRIPTION_ID_KEY, id);
  localStorage.setItem(PUSH_SUBSCRIPTION_REFRESHED_AT_KEY, String(Date.now()));

  // The endpoint changed on this device: the old doc can never be delivered to.
  if (previousId && previousId !== id) {
    deleteDoc(doc(db, "users", uid, "pushSubscriptions", previousId)).catch(
      () => undefined,
    );
  }
  await removeLegacyFcmToken(uid);

  return { status: "ok", id };
}
