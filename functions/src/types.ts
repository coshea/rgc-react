export const MEMBERSHIP_TYPES = {
  FULL: "full",
  HANDICAP: "handicap",
} as const;

export type MembershipType =
  (typeof MEMBERSHIP_TYPES)[keyof typeof MEMBERSHIP_TYPES];
export type MembershipPurpose = "renew" | "handicap";
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
