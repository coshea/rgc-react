export const MEMBERSHIP_TYPES = {
  FULL: "full",
  HANDICAP: "handicap",
} as const;

export type MembershipType =
  (typeof MEMBERSHIP_TYPES)[keyof typeof MEMBERSHIP_TYPES];
export type MembershipPurpose = "renew" | "new" | "handicap";
export type MembershipPaymentPurpose = "dues" | "donation";

export type VerifyAndRecordPayPalRequest = {
  orderId: string;
  year: number;
  membershipType: MembershipType;
  purpose: MembershipPurpose;
};

export type VerifyAndRecordPayPalResponse = {
  ok: boolean;
  reused?: boolean;
  paypalStatus?: string;
  amount?: number;
  currency?: string;
};

export type VerifyAndRecordPayPalDonationRequest = {
  orderId: string;
  year: number;
};

export type VerifyAndRecordPayPalDonationResponse = {
  ok: boolean;
  reused?: boolean;
  paypalStatus?: string;
  amount?: number;
  currency?: string;
};

export type RequestCheckMembershipPaymentRequest = {
  year: number;
  membershipType: MembershipType;
  donationAmount?: number;
  requestId: string;
};

export type RequestCheckMembershipPaymentResponse = {
  ok: boolean;
  groupId: string;
  reused?: boolean;
};

export type ReconcilePayPalOrdersRequest = {
  days?: number;
};

export type ReconcilePayPalOrdersResponse = {
  ok: boolean;
  scanned: number;
  processed: number;
  skipped: number;
  skippedItems: Array<{
    orderId?: string | null;
    customId?: string | null;
    reason: string;
  }>;
  errors: Array<{
    orderId?: string | null;
    customId?: string | null;
    error: string;
  }>;
  error?: string;
};

/**
 * Admin-only record of an address Resend could not deliver to, written by the
 * `resend_webhook` function. Stored at `emailIssues/{lowercased email}` so a
 * member who updates their email is no longer flagged.
 */
export const EMAIL_ISSUES_COLLECTION = "emailIssues";

export const EMAIL_ISSUE_STATUS = {
  BOUNCED: "bounced",
  COMPLAINED: "complained",
  SUPPRESSED: "suppressed",
} as const;

export type EmailIssueStatus =
  (typeof EMAIL_ISSUE_STATUS)[keyof typeof EMAIL_ISSUE_STATUS];

export type EmailIssue = {
  email: string;
  status: EmailIssueStatus;
  /** Provider message, e.g. the bounce reason. */
  reason?: string;
  /** Resend email id of the send that triggered this. */
  emailId?: string;
  /** Resend tag `category` of that send, e.g. `registration_opening`. */
  category?: string;
  /** ISO time Resend reported the event. */
  occurredAt: string;
};

/** Doc id for an address in `emailIssues`. */
export function emailIssueDocId(email: string): string {
  // "/" is legal in an address but not in a Firestore doc id.
  return email.trim().toLowerCase().replace(/\//g, "_");
}
