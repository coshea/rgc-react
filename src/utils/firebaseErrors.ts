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
