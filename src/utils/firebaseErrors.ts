import * as Sentry from "@sentry/react";

export type FirebaseAuthError = {
  code?: string;
  message?: string;
};

export function extractFirebaseAuthError(
  error: unknown
): FirebaseAuthError | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  const code = typeof candidate.code === "string" ? candidate.code : undefined;
  const message =
    typeof candidate.message === "string" ? candidate.message : undefined;

  if (code || message) {
    return { code, message };
  }

  return null;
}

/**
 * True when a Firestore read failed because the device is offline and the
 * document isn't in the local cache. Expected on phones at the course, so
 * it isn't a bug worth reporting.
 */
export function isFirestoreOfflineError(error: unknown): boolean {
  const { code, message = "" } = extractFirebaseAuthError(error) ?? {};
  return (
    code === "unavailable" ||
    /client is offline|could not reach cloud firestore backend/i.test(message)
  );
}

/**
 * True when Firestore's on-device cache (IndexedDB) has failed. Seen on iOS
 * Safari (firebase-js-sdk#8250): after it, every Firestore read and write
 * fails until the page reloads.
 */
export function isFirestoreCacheFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "IndexedDbTransactionError") return true;
  const text = typeof message === "string" ? message : "";
  return (
    /FIRESTORE \(.*\) INTERNAL ASSERTION FAILED/.test(text) ||
    /Attempt to get all index records from database without an in-progress transaction/.test(
      text,
    )
  );
}

/**
 * Error callback for Firestore listeners. Keeps the console message, and
 * reports permission-denied to Sentry: a denied listener means the client
 * subscribed to something the rules don't allow (e.g. before auth), which is
 * a bug rather than a transient network failure.
 */
export function reportListenerError(listener: string, error: unknown): void {
  console.error(`Firestore listener "${listener}" failed`, error);
  if (extractFirebaseAuthError(error)?.code === "permission-denied") {
    Sentry.captureException(error, {
      tags: { error_type: "firestore_listener_denied", listener },
    });
  }
}

const LISTENER_AUTH_RETRIES = 3;
const LISTENER_RETRY_DELAY_MS = 1000;

/**
 * Starts a Firestore listener and resubscribes it a few times when it is
 * denied. Right after sign-in (seen with email-link sign-in since the
 * multi-tab offline cache) Firestore can still run the first listen with the
 * signed-out credentials and deny it, and a denied listener stays dead.
 *
 * `subscribe` must pass the given error callback to `onSnapshot`. Any other
 * error, or a denial that outlasts the retries, is reported with
 * `reportListenerError` and handed to `onFailure`. Returns the cleanup.
 */
export function subscribeWithAuthRetry(
  listener: string,
  subscribe: (onError: (error: unknown) => void) => () => void,
  onFailure?: (error: unknown) => void,
): () => void {
  let unsubscribe = () => {};
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let active = true;

  const start = () => {
    unsubscribe = subscribe((error) => {
      if (!active) return;
      if (
        extractFirebaseAuthError(error)?.code === "permission-denied" &&
        retries < LISTENER_AUTH_RETRIES
      ) {
        retries += 1;
        retryTimer = setTimeout(start, LISTENER_RETRY_DELAY_MS * retries);
        return;
      }
      reportListenerError(listener, error);
      onFailure?.(error);
    });
  };
  start();

  return () => {
    active = false;
    clearTimeout(retryTimer);
    unsubscribe();
  };
}
