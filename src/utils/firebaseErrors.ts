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
