import type { User } from "firebase/auth";

import { getFirebaseFunctionsBaseUrl } from "@/api/functionsBase";
import type {
  VerifyAndRecordPayPalRequest,
  VerifyAndRecordPayPalResponse,
  VerifyAndRecordPayPalDonationRequest,
  VerifyAndRecordPayPalDonationResponse,
} from "@@/types";

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

  const json = (await resp.json().catch(() => null)) as unknown;
  if (!json || typeof json !== "object") {
    throw new Error(
      `Payment recording failed: Invalid response format (Status ${resp.status})`,
    );
  }

  return json as VerifyAndRecordPayPalResponse;
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

  const json = (await resp.json().catch(() => null)) as unknown;
  if (!json || typeof json !== "object") {
    throw new Error(
      `Donation recording failed: Invalid response format (Status ${resp.status})`,
    );
  }

  return json as VerifyAndRecordPayPalDonationResponse;
}
