import { useEffect, useState, useCallback } from "react";
import { db, messaging } from "@/config/firebase";
import { getToken } from "firebase/messaging";
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

  useEffect(() => {
    if (!uid || !messaging || !VAPID_KEY) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const permission = Notification.permission;
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    if (permission === "granted") {
      // Already granted — register/refresh token silently
      registerToken(uid);
    } else if (permission === "default" && !dismissed) {
      setShouldPrompt(true);
    }
    // If "denied", nothing we can do — don't bother the user
  }, [uid]);

  const requestPermission = useCallback(async () => {
    if (!uid) return;
    setShouldPrompt(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registerToken(uid);
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
  if (!messaging || !VAPID_KEY) return;
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

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
