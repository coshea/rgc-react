import * as Sentry from "@sentry/react";
import { FirebaseError } from "firebase/app";

import { addToast } from "@/providers/toast";

/** Reports a failed Wrapped admin action and shows a toast. */
export function reportWrappedError(error: unknown, title: string): void {
  const code = error instanceof FirebaseError ? error.code : "";
  if (code.endsWith("permission-denied")) {
    Sentry.captureException(error);
    addToast({
      title: "Access Denied",
      description: "You do not have permission to perform this action.",
      color: "danger",
    });
    return;
  }
  // failed-precondition / not-found carry a message written for admins
  // (e.g. "Publish Wrapped before sending announcements.").
  const expected = code.endsWith("failed-precondition") || code.endsWith("not-found");
  if (!expected) Sentry.captureException(error);
  addToast({
    title,
    description: expected && error instanceof FirebaseError ? error.message : "Try again in a minute.",
    color: "danger",
  });
}
