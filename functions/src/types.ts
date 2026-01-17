export type MembershipType = "full" | "handicap";
export type MembershipPurpose = "renew" | "handicap";

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
