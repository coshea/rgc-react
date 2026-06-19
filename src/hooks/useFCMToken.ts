import { useEffect, useState, useCallback, useRef } from "react";
import * as Sentry from "@sentry/react";
import { db, messagingReady } from "@/config/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;
const DISMISSED_KEY = "rgc_notif_prompt_dismissed";
/** localStorage key storing the tokenId registered on the current device. */
export const FCM_TOKEN_ID_KEY = "rgc_fcm_token_id";

export interface UseFCMTokenReturn {
  /** True when permission is 'default' and the user hasn't dismissed the prompt. */
  shouldPrompt: boolean;
  /** Call this when the user clicks "Allow" in your custom prompt. */
  requestPermission: () => Promise<void>;
  /** Call this when the user clicks "Not now" — hides the prompt permanently. */
  dismissPrompt: () => void;
}

/**
 * Manages FCM push notification permission and token registration.
 *
 * Does NOT call Notification.requestPermission() automatically — instead it
 * returns shouldPrompt + requestPermission so a custom UI can drive the flow.
 * Once granted, registers the device token in Firestore under
 * users/{uid}/fcmTokens/{tokenId} for multi-device support.
 */
export function useFCMToken(uid: string | null): UseFCMTokenReturn {
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!uid || !VAPID_KEY) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    let cancelled = false;

    messagingReady
      .then((messaging) => {
        if (!messaging || cancelled) return;

        const permission = Notification.permission;
        const dismissed = localStorage.getItem(DISMISSED_KEY);

        if (permission === "granted") {
          // Already granted — register/refresh token silently
          registerToken(uid);
          // Forward foreground (app-focused) FCM messages to the OS notification tray.
          // Background messages are handled by firebase-messaging-sw.js.
          unsubscribeRef.current?.();
          unsubscribeRef.current = onMessage(messaging, (payload) => {
            showForegroundNotification(payload);
          });
        } else if (permission === "default" && !dismissed) {
          setShouldPrompt(true);
        }
        // If "denied", nothing we can do — don't bother the user
      })
      .catch(() => {
        // Browser does not support FCM — silently skip
      });

    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [uid]);

  const requestPermission = useCallback(async () => {
    if (!uid) return;
    setShouldPrompt(false);
    // Clear any previous dismissal so the user can always re-enable from Settings
    localStorage.removeItem(DISMISSED_KEY);
    try {
      const messaging = await messagingReady;
      if (!messaging) return;

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registerToken(uid);
        // Set up foreground listener for this session immediately after grant
        unsubscribeRef.current?.();
        unsubscribeRef.current = onMessage(messaging, (payload) => {
          showForegroundNotification(payload);
        });
      }
    } catch (err) {
      Sentry.captureException(err);
      console.warn("[FCM] Permission request failed:", err);
    }
  }, [uid]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShouldPrompt(false);
  }, []);

  return { shouldPrompt, requestPermission, dismissPrompt };
}

import type { MessagePayload } from "firebase/messaging";

function showForegroundNotification(payload: MessagePayload): void {
  const title = payload.notification?.title ?? "Ridgefield Golf Club";
  const options: NotificationOptions = {
    body: payload.notification?.body ?? "",
    icon: "/rgc_fav.png",
    data: payload.data ?? {},
  };
  const browserNavigator =
    typeof navigator === "undefined" ? undefined : navigator;

  // Prefer SW-backed showNotification (required for notificationclick to fire)
  if (browserNavigator && "serviceWorker" in browserNavigator) {
    browserNavigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => {
        // SW showNotification failed — fall back to direct Notification API
        if (Notification.permission === "granted") {
          new Notification(title, options);
        }
      });
  } else if (Notification.permission === "granted") {
    new Notification(title, options);
  }
}

async function registerToken(uid: string): Promise<void> {
  if (!VAPID_KEY) return;
  try {
    const messaging = await messagingReady;
    if (!messaging) return;
    const browserNavigator =
      typeof navigator === "undefined" ? undefined : navigator;
    let swReg: ServiceWorkerRegistration | undefined;
    if (browserNavigator && "serviceWorker" in browserNavigator) {
      // Register the SW (idempotent), then use the *active* registration from
      // `ready`. During a SW update, `register()` may return the incoming
      // (installing) registration whose `.active` is null, while the old
      // worker is still active — passing that to `getToken` would cause
      // `pushManager.subscribe()` to fail. `ready` always resolves with the
      // currently-active registration so getToken succeeds.
      await browserNavigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        {
          scope: "/",
        },
      );
      swReg = await browserNavigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });

    if (!token) return;

    // Truncated base64 of the token → stable doc ID; idempotent on repeat calls.
    const tokenId = btoa(token)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 28);
    await setDoc(doc(db, "users", uid, "fcmTokens", tokenId), {
      token,
      createdAt: serverTimestamp(),
      userAgent: browserNavigator?.userAgent.slice(0, 256) ?? "",
    });
    // Track the current device's tokenId so logout can remove only this doc.
    localStorage.setItem(FCM_TOKEN_ID_KEY, tokenId);
  } catch (err) {
    Sentry.captureException(err);
    console.warn("[FCM] Token registration failed:", err);
  }
}
