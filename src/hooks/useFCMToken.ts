import { useEffect, useState, useCallback, useRef } from "react";
import { db, messaging } from "@/config/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;
const DISMISSED_KEY = "rgc_notif_prompt_dismissed";

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
    if (!uid || !messaging || !VAPID_KEY) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const permission = Notification.permission;
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    if (permission === "granted") {
      // Already granted — register/refresh token silently
      registerToken(uid);
      // Forward foreground (app-focused) FCM messages to the OS notification tray.
      // Background messages are handled by firebase-messaging-sw.js.
      unsubscribeRef.current?.();
      unsubscribeRef.current = onMessage(messaging, (payload) => {
        navigator.serviceWorker.ready
          .then((reg) =>
            reg.showNotification(
              payload.notification?.title ?? "Ridgefield Golf Club",
              {
                body: payload.notification?.body ?? "",
                icon: "/rgc_fav.png",
                data: payload.data ?? {},
              },
            ),
          )
          .catch(() => {});
      });
    } else if (permission === "default" && !dismissed) {
      setShouldPrompt(true);
    }
    // If "denied", nothing we can do — don't bother the user

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [uid]);

  const requestPermission = useCallback(async () => {
    if (!uid) return;
    setShouldPrompt(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registerToken(uid);
        // Set up foreground listener for this session immediately after grant
        if (messaging) {
          unsubscribeRef.current?.();
          unsubscribeRef.current = onMessage(messaging, (payload) => {
            navigator.serviceWorker.ready
              .then((reg) =>
                reg.showNotification(
                  payload.notification?.title ?? "Ridgefield Golf Club",
                  {
                    body: payload.notification?.body ?? "",
                    icon: "/rgc_fav.png",
                    data: payload.data ?? {},
                  },
                ),
              )
              .catch(() => {});
          });
        }
      }
    } catch (err) {
      console.warn("[FCM] Permission request failed:", err);
    }
  }, [uid]);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShouldPrompt(false);
  }, []);

  return { shouldPrompt, requestPermission, dismissPrompt };
}

async function registerToken(uid: string): Promise<void> {
  if (!messaging || !VAPID_KEY) {
    console.warn(
      "[FCM] Skipping registerToken: messaging or VAPID_KEY not set",
    );
    return;
  }
  try {
    // Explicitly register the service worker so we can hand it to getToken().
    // This avoids a race where Firebase's auto-registration hasn't finished, and
    // also forces the browser to pick up any updated SW file immediately.
    let swReg: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" },
      );
      // Wait for the SW to activate before requesting a token
      await navigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
    });

    if (!token) {
      console.warn(
        "[FCM] getToken returned empty — check VAPID key and service worker",
      );
      return;
    }

    // Truncated base64 of the token → stable doc ID; idempotent on repeat calls.
    const tokenId = btoa(token)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 28);
    await setDoc(doc(db, "users", uid, "fcmTokens", tokenId), {
      token,
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent.slice(0, 256),
    });
  } catch (err) {
    console.warn("[FCM] Token registration failed:", err);
  }
}
