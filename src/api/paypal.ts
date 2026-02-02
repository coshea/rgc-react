import type { User } from "firebase/auth";

import { getFirebaseFunctionsBaseUrl } from "@/api/functionsBase";

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

export async function verifyAndRecordPayPalMembershipPayment(params: {
  user: User;
  request: VerifyAndRecordPayPalRequest;
}): Promise<VerifyAndRecordPayPalResponse> {
  const { user, request } = params;

  if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
    throw new Error(
      "User must be authenticated with a valid UID to verify membership payment.",
    );
  }
  const baseUrl = getFirebaseFunctionsBaseUrl();

  const token = await user.getIdToken();

  const resp = await fetch(`${baseUrl}/verify_and_record_membership_payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Payment recording failed: ${resp.status} ${text}`.trim());
  }

  return (await resp.json()) as VerifyAndRecordPayPalResponse;
}

export async function verifyAndRecordPayPalDonationPayment(params: {
  user: User;
  request: VerifyAndRecordPayPalDonationRequest;
}): Promise<VerifyAndRecordPayPalDonationResponse> {
  const { user, request } = params;

  if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
    throw new Error(
      "User must be authenticated with a valid UID to verify donation payment.",
    );
  }
  const baseUrl = getFirebaseFunctionsBaseUrl();

  const token = await user.getIdToken();

  const resp = await fetch(`${baseUrl}/verify_and_record_donation_payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Donation recording failed: ${resp.status} ${text}`.trim());
  }

  return (await resp.json()) as VerifyAndRecordPayPalDonationResponse;
}
