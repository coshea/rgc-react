import type { User } from "firebase/auth";

import { getFirebaseFunctionsBaseUrl } from "@/api/functionsBase";
import type {
  VerifyAndRecordPayPalRequest,
  VerifyAndRecordPayPalResponse,
  VerifyAndRecordPayPalDonationRequest,
  VerifyAndRecordPayPalDonationResponse,
} from "@@/types";

/** Retry a fetch up to `maxAttempts` times on network-level failures (TypeError). */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        // Only retry on network errors (TypeError: Failed to fetch), not server errors.
        if (!(err instanceof TypeError)) throw err;
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt - 1)),
        );
      }
    }
  }
  throw lastError;
}

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

  const resp = await fetchWithRetry(
    `${baseUrl}/verify_and_record_membership_payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    },
  );

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

  const resp = await fetchWithRetry(
    `${baseUrl}/verify_and_record_donation_payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    },
  );

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
