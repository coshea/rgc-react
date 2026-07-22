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
  getAnalytics,
  isSupported as analyticsIsSupported,
  type Analytics,
} from "firebase/analytics";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";
import { getMessaging, type Messaging } from "firebase/messaging";

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

// If you plan to use other Firebase services like Firestore,
// initialize them here and export as well:
import { getFirestore, Firestore } from "firebase/firestore";
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

// Firebase Analytics is gated behind explicit user consent.
// We expose a lazy initializer so the app can enable analytics only after opt-in.
let analytics: Analytics | undefined = undefined;

export async function enableAnalytics(): Promise<Analytics | undefined> {
  try {
    const supported = await analyticsIsSupported();
    if (supported && !analytics) {
      analytics = getAnalytics(app);
    }
  } catch {
    // ignore analytics initialization failures in non-browser environments
  }
  return analytics;
}

// Getter for current analytics instance (may be undefined if not enabled)
export function getAnalyticsInstance(): Analytics | undefined {
  return analytics;
}

// FCM Messaging — only available in browser environments with service worker support.
// Skipped in Vitest environments where the Messaging API is unavailable.
// isSupported() is checked asynchronously to avoid throwing on iOS Safari where
// the Push/Service Worker APIs required by FCM are absent.
let messaging: Messaging | null = null;
let _messagingResolve: ((m: Messaging | null) => void) | null = null;
const messagingReady: Promise<Messaging | null> = new Promise(
  (resolve) => (_messagingResolve = resolve),
);

if (!import.meta.env.VITEST && typeof window !== "undefined") {
  import("firebase/messaging")
    .then(({ isSupported }) => isSupported())
    .then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
      }
      _messagingResolve!(messaging);
    })
    .catch(() => {
      _messagingResolve!(null);
    });
} else {
  _messagingResolve!(null);
}

export { auth, db, analytics, storage, functions, messaging, messagingReady };
