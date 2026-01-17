import type {
  MembershipPurpose,
  MembershipType,
  VerifyAndRecordPayPalRequest,
} from "./types";

// Valid year bounds for membership payments validation. These replace magic
// numbers previously embedded in the validation logic and make intent clear.
const MIN_VALID_YEAR = 2020;
const MAX_VALID_YEAR = 2100;

function isMembershipType(v: unknown): v is MembershipType {
  return v === "full" || v === "handicap";
}

function isMembershipPurpose(v: unknown): v is MembershipPurpose {
  return v === "renew" || v === "handicap";
}

export function parseVerifyRequest(
  body: unknown
): VerifyAndRecordPayPalRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const record = body as Record<string, unknown>;

  const orderId = record.orderId;
  const year = record.year;
  const membershipType = record.membershipType;
  const purpose = record.purpose;

  if (typeof orderId !== "string" || !orderId.trim()) {
    throw new Error("Missing orderId");
  }

  if (
    typeof year !== "number" ||
    !Number.isFinite(year) ||
    year < MIN_VALID_YEAR ||
    year > MAX_VALID_YEAR
  ) {
    throw new Error("Invalid year");
  }

  if (!isMembershipType(membershipType)) {
    throw new Error("Invalid membershipType");
  }

  if (!isMembershipPurpose(purpose)) {
    throw new Error("Invalid purpose");
  }

  return {
    orderId: orderId.trim(),
    year,
    membershipType,
    purpose,
  };
}
