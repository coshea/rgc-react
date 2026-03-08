import type { firestore as AdminFirestore } from "firebase-admin";

import type { FirestoreWriteTime } from "./httpUtils";

import { MEMBERSHIP_TYPES } from "./types";
import type { MembershipType } from "./types";

export type RecordPayPalPaymentParams = {
  uid: string;
  year: number;
  membershipType: MembershipType;
  purpose: "renew" | "handicap";
  amount?: number;
  currency?: string;
  paypalStatus?: string;
  orderId: string;
};

export type RecordCheckPaymentParams = {
  uid: string;
  year: number;
  membershipType: MembershipType;
  donationAmount?: number;
  requestId: string;
};

export type RecordPayPalDonationParams = {
  uid: string;
  year: number;
  amount?: number;
  currency?: string;
  paypalStatus?: string;
  orderId: string;
};

const DEFAULT_FULL_MEMBERSHIP_FEE = 85;
const DEFAULT_HANDICAP_FEE = 50;

function resolveUserDisplayName(
  data: Record<string, unknown> | undefined,
): string | null {
  if (!data) return null;

  const displayName =
    typeof data.displayName === "string" ? data.displayName.trim() : "";
  if (displayName) return displayName;

  const firstName =
    typeof data.firstName === "string" ? data.firstName.trim() : "";
  const lastName =
    typeof data.lastName === "string" ? data.lastName.trim() : "";
  const combined = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return combined || null;
}

async function resolveMembershipFee(
  db: AdminFirestore.Firestore,
  membershipType: MembershipType,
): Promise<number> {
  try {
    const settingsSnap = await db
      .collection("config")
      .doc("membershipSettings")
      .get();
    if (settingsSnap.exists) {
      const data = settingsSnap.data() as Record<string, unknown>;
      const raw =
        membershipType === MEMBERSHIP_TYPES.FULL
          ? data.fullMembershipPrice
          : data.handicapMembershipPrice;
      if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
        return raw;
      }
    }
  } catch {
    // Fallback to defaults when settings are unavailable.
  }

  return membershipType === MEMBERSHIP_TYPES.FULL
    ? DEFAULT_FULL_MEMBERSHIP_FEE
    : DEFAULT_HANDICAP_FEE;
}

export async function recordPayPalMembershipPayment(params: {
  db: AdminFirestore.Firestore;
  now: FirestoreWriteTime;
  payment: RecordPayPalPaymentParams;
}): Promise<{ reused: boolean }> {
  const { db, now, payment } = params;

  const paypalOrderRef = db.collection("paypalOrders").doc(payment.orderId);
  const duesPaymentId = `${payment.orderId}_dues`;
  const donationPaymentId = `${payment.orderId}_donation`;
  const memberDuesRef = db.collection("memberPayments").doc(duesPaymentId);
  const memberDonationRef = db
    .collection("memberPayments")
    .doc(donationPaymentId);
  const userRef = db.collection("users").doc(payment.uid);

  const totalAmount = payment.amount ?? null;
  if (totalAmount == null || !Number.isFinite(totalAmount)) {
    throw new Error("PayPal order missing amount");
  }

  const membershipFee = await resolveMembershipFee(db, payment.membershipType);
  if (totalAmount + 0.001 < membershipFee) {
    throw new Error("PayPal amount below membership fee");
  }

  const donationAmountRaw = totalAmount - membershipFee;
  const donationAmount = Number.isFinite(donationAmountRaw)
    ? Math.max(0, Number(donationAmountRaw.toFixed(2)))
    : 0;

  const reused = await db.runTransaction(async (tx) => {
    // Read first (all reads before any writes per Firestore transaction rules)
    const [
      existingOrder,
      existingMemberDues,
      existingMemberDonation,
      userSnap,
    ] = await Promise.all([
      tx.get(paypalOrderRef),
      tx.get(memberDuesRef),
      tx.get(memberDonationRef),
      tx.get(userRef),
    ]);

    const userDisplayName = resolveUserDisplayName(
      userSnap.exists
        ? (userSnap.data() as Record<string, unknown>)
        : undefined,
    );

    if (!existingOrder.exists) {
      tx.set(paypalOrderRef, {
        uid: payment.uid,
        year: payment.year,
        membershipType: payment.membershipType,
        purpose: payment.purpose,
        amount: totalAmount,
        membershipFee,
        donationAmount,
        currency: payment.currency ?? null,
        paypalStatus: payment.paypalStatus ?? null,
        createdAt: now,
      });
    }

    if (!existingMemberDues.exists) {
      tx.set(memberDuesRef, {
        userId: payment.uid,
        displayName: userDisplayName,
        year: payment.year,
        createdAt: now,
        paidAt: now,
        amount: membershipFee,
        method: "paypal",
        membershipType: payment.membershipType,
        purpose: "dues",
        recordedBy: null,
        status: "confirmed",
        groupId: payment.orderId,
      });
    }

    if (donationAmount > 0 && !existingMemberDonation.exists) {
      tx.set(memberDonationRef, {
        userId: payment.uid,
        displayName: userDisplayName,
        year: payment.year,
        createdAt: now,
        paidAt: now,
        amount: donationAmount,
        method: "paypal",
        membershipType: payment.membershipType,
        purpose: "donation",
        recordedBy: null,
        status: "confirmed",
        groupId: payment.orderId,
      });
    }

    tx.set(
      userRef,
      {
        lastPaidYear: payment.year,
        membershipType: payment.membershipType,
        updatedAt: now,
      },
      { merge: true },
    );

    return (
      existingOrder.exists &&
      existingMemberDues.exists &&
      (donationAmount <= 0 || existingMemberDonation.exists)
    );
  });

  return { reused };
}

export async function recordCheckMembershipPayment(params: {
  db: AdminFirestore.Firestore;
  now: FirestoreWriteTime;
  payment: RecordCheckPaymentParams;
}): Promise<{ groupId: string; reused: boolean }> {
  const { db, now, payment } = params;
  const membershipFee = await resolveMembershipFee(db, payment.membershipType);
  const donationAmountRaw = payment.donationAmount ?? 0;
  const donationAmount = Number.isFinite(donationAmountRaw)
    ? Math.max(0, Number(donationAmountRaw.toFixed(2)))
    : 0;

  const groupId = `check_${payment.uid}_${payment.year}_${payment.requestId}`;
  const duesPaymentId = `${groupId}_dues`;
  const donationPaymentId = `${groupId}_donation`;

  const memberDuesRef = db.collection("memberPayments").doc(duesPaymentId);
  const memberDonationRef = db
    .collection("memberPayments")
    .doc(donationPaymentId);
  const userRef = db.collection("users").doc(payment.uid);

  const reused = await db.runTransaction(async (tx) => {
    const [existingDues, existingDonation, userSnap] = await Promise.all([
      tx.get(memberDuesRef),
      tx.get(memberDonationRef),
      tx.get(userRef),
    ]);

    const userDisplayName = resolveUserDisplayName(
      userSnap.exists
        ? (userSnap.data() as Record<string, unknown>)
        : undefined,
    );

    if (existingDues.exists) return true;

    tx.set(memberDuesRef, {
      userId: payment.uid,
      displayName: userDisplayName,
      year: payment.year,
      createdAt: now,
      paidAt: null,
      amount: membershipFee,
      method: "check",
      membershipType: payment.membershipType,
      purpose: "dues",
      recordedBy: null,
      status: "pending",
      groupId,
    });

    if (donationAmount > 0 && !existingDonation.exists) {
      tx.set(memberDonationRef, {
        userId: payment.uid,
        displayName: userDisplayName,
        year: payment.year,
        createdAt: now,
        paidAt: null,
        amount: donationAmount,
        method: "check",
        membershipType: payment.membershipType,
        purpose: "donation",
        recordedBy: null,
        status: "pending",
        groupId,
      });
    }

    return false;
  });

  return { groupId, reused };
}

export async function recordPayPalDonationPayment(params: {
  db: AdminFirestore.Firestore;
  now: FirestoreWriteTime;
  payment: RecordPayPalDonationParams;
}): Promise<{ reused: boolean }> {
  const { db, now, payment } = params;

  const paypalOrderRef = db.collection("paypalOrders").doc(payment.orderId);
  const donationPaymentId = `${payment.orderId}_donation`;
  const memberDonationRef = db
    .collection("memberPayments")
    .doc(donationPaymentId);
  const userRef = db.collection("users").doc(payment.uid);

  const totalAmount = payment.amount ?? null;
  if (totalAmount == null || !Number.isFinite(totalAmount)) {
    throw new Error("PayPal order missing amount");
  }

  const reused = await db.runTransaction(async (tx) => {
    const [existingOrder, existingDonation, userSnap] = await Promise.all([
      tx.get(paypalOrderRef),
      tx.get(memberDonationRef),
      tx.get(userRef),
    ]);

    const userDisplayName = resolveUserDisplayName(
      userSnap.exists
        ? (userSnap.data() as Record<string, unknown>)
        : undefined,
    );

    if (!existingOrder.exists) {
      tx.set(paypalOrderRef, {
        uid: payment.uid,
        year: payment.year,
        purpose: "donation",
        amount: totalAmount,
        donationAmount: totalAmount,
        currency: payment.currency ?? null,
        paypalStatus: payment.paypalStatus ?? null,
        createdAt: now,
      });
    }

    if (!existingDonation.exists) {
      tx.set(memberDonationRef, {
        userId: payment.uid,
        displayName: userDisplayName,
        year: payment.year,
        createdAt: now,
        paidAt: now,
        amount: totalAmount,
        method: "paypal",
        purpose: "donation",
        recordedBy: null,
        status: "confirmed",
        groupId: payment.orderId,
      });
    }

    return existingOrder.exists && existingDonation.exists;
  });

  return { reused };
}
