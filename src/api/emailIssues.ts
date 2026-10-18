import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import * as Sentry from "@sentry/react";

import { db } from "@/config/firebase";
import {
  EMAIL_ISSUES_COLLECTION,
  type EmailIssue,
  emailIssueDocId,
} from "@@/types";

/**
 * Addresses Resend could not deliver to (bounced, spam complaint, or
 * suppressed), keyed by lowercased email. Written by the `resend_webhook`
 * Cloud Function; readable and clearable by admins only.
 */
export async function getEmailIssues(): Promise<Map<string, EmailIssue>> {
  return Sentry.startSpan(
    { name: "getEmailIssues", op: "db.query" },
    async () => {
      const snap = await getDocs(collection(db, EMAIL_ISSUES_COLLECTION));
      return new Map(
        snap.docs.map((d) => [d.id, d.data() as EmailIssue] as const),
      );
    },
  );
}

/** Admin: forget an issue, e.g. after the member confirms their address works. */
export async function clearEmailIssue(email: string): Promise<void> {
  await Sentry.startSpan({ name: "clearEmailIssue", op: "db.write" }, () =>
    deleteDoc(doc(db, EMAIL_ISSUES_COLLECTION, emailIssueDocId(email))),
  );
}
