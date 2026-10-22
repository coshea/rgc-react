import { useEffect, useCallback, useState } from "react";
import * as Sentry from "@sentry/react";
import { db } from "@/config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import type { AppNotification } from "@/types/notification";
import {
  extractFirebaseAuthError,
  reportListenerError,
} from "@/utils/firebaseErrors";

const LISTENER_AUTH_RETRIES = 3;
const LISTENER_RETRY_DELAY_MS = 1000;

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

async function syncServiceWorkerBadgeCount(count: number): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: "BADGE_SYNC", count });
  } catch {
    // Badge syncing is opportunistic and should never break notifications.
  }
}

async function syncAppBadge(count: number): Promise<void> {
  if (typeof navigator === "undefined") return;

  const badgeNavigator = navigator as BadgeNavigator;

  try {
    if (count > 0) {
      await badgeNavigator.setAppBadge?.(count);
    } else if (badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge();
    } else {
      await badgeNavigator.setAppBadge?.(0);
    }
  } catch {
    // Ignore badging failures on unsupported or restricted browsers.
  }

  await syncServiceWorkerBadgeCount(count);
}

export interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * Real-time subscription to the current user's notifications, ordered newest-first.
 * Provides helpers for marking read, dismissing individual items, and clearing all.
 * Automatically unsubscribes when uid changes or the component unmounts.
 */
export function useNotifications(
  uid: string | null | undefined,
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "notifications"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    // Right after sign-in (seen with email-link sign-in since the multi-tab
    // offline cache) Firestore can still run the first listen with the
    // signed-out credentials and deny it. A denied listener stays dead, so
    // resubscribe a few times before treating it as a real failure.
    let unsubscribe = () => {};
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;

    const subscribe = () => {
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as AppNotification[];
          setNotifications(docs);
          setLoading(false);
        },
        (err) => {
          if (
            extractFirebaseAuthError(err)?.code === "permission-denied" &&
            retries < LISTENER_AUTH_RETRIES
          ) {
            retries += 1;
            retryTimer = setTimeout(subscribe, LISTENER_RETRY_DELAY_MS * retries);
            return;
          }
          reportListenerError("notifications", err);
          setLoading(false);
        },
      );
    };
    subscribe();

    return () => {
      clearTimeout(retryTimer);
      unsubscribe();
    };
  }, [uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!uid) {
      void syncAppBadge(0);
      return;
    }

    if (loading) return;
    void syncAppBadge(unreadCount);
  }, [uid, unreadCount, loading]);

  const markRead = useCallback(
    async (id: string) => {
      if (!uid) return;
      // firestore.rules only permits the unread -> read transition, so
      // re-marking an already-read notification would be denied.
      if (notifications.find((n) => n.id === id)?.read) return;
      try {
        await updateDoc(doc(db, "notifications", id), { read: true });
      } catch (err) {
        // Best-effort: callers fire-and-forget this on tap, so never reject.
        Sentry.captureException(err);
      }
    },
    [uid, notifications],
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true });
    });
    await batch.commit();
  }, [uid, notifications]);

  const dismissNotification = useCallback(
    async (id: string) => {
      if (!uid) return;
      await deleteDoc(doc(db, "notifications", id));
    },
    [uid],
  );

  const clearAll = useCallback(async () => {
    if (!uid || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach((n) => {
      batch.delete(doc(db, "notifications", n.id));
    });
    await batch.commit();
  }, [uid, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    dismissNotification,
    clearAll,
  };
}
