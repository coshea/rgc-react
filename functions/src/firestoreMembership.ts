import type { firestore as AdminFirestore } from "firebase-admin";

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

export async function recordPayPalMembershipPayment(params: {
  db: AdminFirestore.Firestore;
  now: AdminFirestore.FieldValue;
  payment: RecordPayPalPaymentParams;
}): Promise<{ reused: boolean }> {
  const { db, now, payment } = params;

  const paypalOrderRef = db.collection("paypalOrders").doc(payment.orderId);
  const memberPaymentId = `${payment.uid}_${payment.year}`;
  const memberPaymentRef = db.collection("memberPayments").doc(memberPaymentId);
  const userRef = db.collection("users").doc(payment.uid);

  const reused = await db.runTransaction(async (tx) => {
    // Read first (all reads before any writes per Firestore transaction rules)
    const [existingOrder, existingMemberPayment] = await Promise.all([
      tx.get(paypalOrderRef),
      tx.get(memberPaymentRef),
    ]);

    if (existingOrder.exists) return true;

    tx.set(paypalOrderRef, {
      uid: payment.uid,
      year: payment.year,
      membershipType: payment.membershipType,
      purpose: payment.purpose,
      amount: payment.amount ?? null,
      currency: payment.currency ?? null,
      paypalStatus: payment.paypalStatus ?? null,
      createdAt: now,
    });

    if (!existingMemberPayment.exists) {
      tx.set(memberPaymentRef, {
        userId: payment.uid,
        year: payment.year,
        paidAt: now,
        amount: payment.amount ?? null,
        method: "paypal",
        membershipType: payment.membershipType,
        recordedBy: null,
        status: "confirmed",
      });
    }

    tx.set(
      userRef,
      {
        lastPaidYear: payment.year,
        membershipType: payment.membershipType,
        updatedAt: now,
      },
      { merge: true }
    );

    return false;
  });

  return { reused };
}
