import type * as admin from "firebase-admin";

import { EMAIL_ISSUES_COLLECTION } from "./types";

/**
 * Doc ids (lowercased addresses, see `emailIssueDocId`) that Resend reported
 * as bounced, spam-complained or suppressed. Senders skip these.
 */
export async function getEmailIssueAddresses(
  db: admin.firestore.Firestore,
): Promise<Set<string>> {
  const snap = await db.collection(EMAIL_ISSUES_COLLECTION).get();
  return new Set(snap.docs.map((doc) => doc.id));
}
