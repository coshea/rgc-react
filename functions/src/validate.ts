import type {
  MembershipPurpose,
  MembershipType,
  RequestCheckMembershipPaymentRequest,
  VerifyAndRecordPayPalDonationRequest,
  VerifyAndRecordPayPalRequest,
} from "./types";
import { MEMBERSHIP_TYPES } from "./types";

// Valid year bounds for membership payments validation. These replace magic
// numbers previously embedded in the validation logic and make intent clear.
const MIN_VALID_YEAR = 2020;
const MAX_VALID_YEAR = 2100;

function isMembershipType(v: unknown): v is MembershipType {
  return v === MEMBERSHIP_TYPES.FULL || v === MEMBERSHIP_TYPES.HANDICAP;
}

function isMembershipPurpose(v: unknown): v is MembershipPurpose {
  return v === "renew" || v === "handicap";
}

function isNonNegativeNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

export function parseVerifyRequest(
  body: unknown,
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

export function parseCheckPaymentRequest(
  body: unknown,
): RequestCheckMembershipPaymentRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const record = body as Record<string, unknown>;

  const year = record.year;
  const membershipType = record.membershipType;
  const donationAmount = record.donationAmount;
  const requestId = record.requestId;

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

  if (donationAmount !== undefined && !isNonNegativeNumber(donationAmount)) {
    throw new Error("Invalid donationAmount");
  }

  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new Error("Missing requestId");
  }

  return {
    year,
    membershipType,
    donationAmount:
      donationAmount === undefined ? undefined : Number(donationAmount),
    requestId: requestId.trim(),
  };
}

export function parseDonationVerifyRequest(
  body: unknown,
): VerifyAndRecordPayPalDonationRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const record = body as Record<string, unknown>;

  const orderId = record.orderId;
  const year = record.year;

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

  return {
    orderId: orderId.trim(),
    year,
  };
}
