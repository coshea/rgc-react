import { initializeApp, FirebaseApp } from "firebase/app";
import {
  Auth,
  browserPopupRedirectResolver,
  browserLocalPersistence,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  setPersistence,
} from "firebase/auth";
import {
  initializeAnalytics,
  isSupported as analyticsIsSupported,
  setAnalyticsCollectionEnabled,
  type Analytics,
} from "firebase/analytics";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCdj-5oF0d92kfoseQFENIdw7E4Ft7A_7w",
  // Use the custom domain so Firebase's auth redirect handler runs on the same
  // origin as the app. This avoids Safari ITP blocking the cross-origin iframe
  // that transfers the credential from ridgefield-golf-club.firebaseapp.com.
  authDomain: "ridgefieldgolfclub.org",
  projectId: "ridgefield-golf-club",
  storageBucket: "ridgefield-golf-club.firebasestorage.app",
  messagingSenderId: "210348651103",
  appId: "1:210348651103:web:b2102bd7200cc7be1121ea",
  measurementId: "G-JB5LWL67NH",
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const authPersistence = [
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
];

const shouldUsePopupRedirectResolver = !import.meta.env.VITEST;

const auth: Auth = initializeAuth(app, {
  ...(shouldUsePopupRedirectResolver && {
    popupRedirectResolver: browserPopupRedirectResolver,
  }),
  persistence: authPersistence,
});

let authPersistenceDowngraded = false;

function isIndexedDbClosingError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybeError = error as { code?: unknown; message?: unknown };
  const code =
    typeof maybeError.code === "string" ? maybeError.code.toLowerCase() : "";
  const message =
    typeof maybeError.message === "string"
      ? maybeError.message.toLowerCase()
      : "";

  return (
    code.includes("app/idb-set") ||
    (message.includes("indexeddb") && message.includes("database connection"))
  );
}

async function downgradeAuthPersistence(): Promise<void> {
  if (authPersistenceDowngraded) return;

  try {
    await setPersistence(auth, browserLocalPersistence);
    authPersistenceDowngraded = true;
    return;
  } catch {
    // Try in-memory as a final fallback.
  }

  await setPersistence(auth, inMemoryPersistence);
  authPersistenceDowngraded = true;
}

export async function withAuthPersistenceRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isIndexedDbClosingError(error)) {
      throw error;
    }

    await downgradeAuthPersistence();
    return operation();
  }
}

import {
  clearIndexedDbPersistence,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  Firestore,
} from "firebase/firestore";

// Firestore keeps what members have read in IndexedDB, so the tournament list
// and their registrations still load at the course with no reception. The
// multi-tab manager shares one cache between open tabs. The SDK falls back to
// memory by itself where IndexedDB is unavailable; tests always use memory.
const db: Firestore = initializeFirestore(app, {
  localCache: import.meta.env.VITEST
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/**
 * Deletes the Firestore data saved on this device, so the next person on a
 * shared computer can't read it. `db` is unusable afterwards; reload the page.
 * Returns false when the cache couldn't be cleared (e.g. another tab has it
 * open); it is still shut down.
 */
export async function clearOfflineData(): Promise<boolean> {
  await terminate(db);
  try {
    await clearIndexedDbPersistence(db);
    return true;
  } catch {
    return false;
  }
}

const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

// Firebase Analytics is gated behind explicit user consent.
// We expose a lazy initializer so the app can enable analytics only after opt-in.
let analytics: Analytics | undefined = undefined;

export async function enableAnalytics(): Promise<Analytics | undefined> {
  try {
    const supported = await analyticsIsSupported();
    if (supported && !analytics) {
      analytics = initializeAnalytics(app, {
        config: { send_page_view: false },
      });
    } else if (analytics) {
      // Re-enabling after the user rejected and then accepted again.
      setAnalyticsCollectionEnabled(analytics, true);
    }
  } catch {
    // ignore analytics initialization failures in non-browser environments
  }
  return analytics;
}

// Stops collection immediately when the user withdraws consent, and removes
// the GA cookies already set. Without this, analytics keeps sending until the
// next page load.
export function disableAnalytics(): void {
  if (analytics) {
    try {
      setAnalyticsCollectionEnabled(analytics, false);
    } catch {
      // ignore; the cookies below are still cleared
    }
  }
  clearGoogleAnalyticsCookies();
}

function clearGoogleAnalyticsCookies(): void {
  if (typeof document === "undefined") return;
  // GA sets _ga / _ga_<id> on the top-level domain, so try every parent
  // domain of the current host as well as the host itself.
  const parts = window.location.hostname.split(".");
  const domains = parts.map((_, i) => parts.slice(i).join("."));
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name || !name.startsWith("_ga")) continue;
    const expire = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = expire;
    for (const domain of domains) {
      document.cookie = `${expire}; domain=.${domain}`;
    }
  }
}

// Getter for current analytics instance (may be undefined if not enabled)
export function getAnalyticsInstance(): Analytics | undefined {
  return analytics;
}

export { auth, db, analytics, storage, functions };
