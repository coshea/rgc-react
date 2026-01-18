import type { firestore as AdminFirestore } from "firebase-admin";

import type {
  VerifyAndRecordPayPalRequest,
  VerifyAndRecordPayPalResponse,
} from "./types";
import type { PayPalEnvironment, PayPalOrderSummary } from "./paypal";
import { fetchPayPalAccessToken, fetchPayPalOrder } from "./paypal";
import { logger } from "./logger";
import { recordPayPalMembershipPayment } from "./firestoreMembership";

export type VerifyDeps = {
  db: AdminFirestore.Firestore;
  now: AdminFirestore.FieldValue;
  paypal: {
    env: PayPalEnvironment;
    clientId: string;
    clientSecret: string;
    fetchImpl?: typeof fetch;
  };
};

export async function verifyAndRecordMembershipPayment(params: {
  uid: string;
  request: VerifyAndRecordPayPalRequest;
  deps: VerifyDeps;
}): Promise<VerifyAndRecordPayPalResponse> {
  const { uid, request, deps } = params;
  logger.info("verifyAndRecordMembershipPayment: start", {
    uid,
    orderId: request.orderId,
    year: request.year,
    membershipType: request.membershipType,
    purpose: request.purpose,
  });

  const accessToken = await fetchPayPalAccessToken({
    env: deps.paypal.env,
    clientId: deps.paypal.clientId,
    clientSecret: deps.paypal.clientSecret,
    fetchImpl: deps.paypal.fetchImpl,
  });

  logger.info("verifyAndRecordMembershipPayment: fetched PayPal access token", {
    uid,
    orderId: request.orderId,
  });

  const order: PayPalOrderSummary = await fetchPayPalOrder({
    env: deps.paypal.env,
    accessToken,
    orderId: request.orderId,
    fetchImpl: deps.paypal.fetchImpl,
  });

  logger.info("verifyAndRecordMembershipPayment: fetched PayPal order", {
    uid,
    orderId: order.id,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
  });

  const paypalStatus = order.status;
  const amount = order.amount;
  const currency = order.currency;

  if (!paypalStatus) {
    throw new Error("PayPal order missing status");
  }

  if (paypalStatus !== "COMPLETED") {
    logger.warn(
      "verifyAndRecordMembershipPayment: non-completed PayPal status",
      {
        uid,
        orderId: request.orderId,
        paypalStatus,
      }
    );

    return {
      ok: false,
      paypalStatus,
      amount,
      currency,
    };
  }

  logger.info(
    "verifyAndRecordMembershipPayment: recording payment to Firestore",
    {
      uid,
      orderId: request.orderId,
      year: request.year,
    }
  );

  const { reused } = await recordPayPalMembershipPayment({
    db: deps.db,
    now: deps.now,
    payment: {
      uid,
      year: request.year,
      membershipType: request.membershipType,
      purpose: request.purpose,
      amount,
      currency,
      paypalStatus,
      orderId: request.orderId,
    },
  });

  logger.info("verifyAndRecordMembershipPayment: recorded payment", {
    uid,
    orderId: request.orderId,
    reused,
  });

  return {
    ok: true,
    reused,
    paypalStatus,
    amount,
    currency,
  };
}
