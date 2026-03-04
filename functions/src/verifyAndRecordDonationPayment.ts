import type { firestore as AdminFirestore } from "firebase-admin";

import type {
  VerifyAndRecordPayPalDonationRequest,
  VerifyAndRecordPayPalDonationResponse,
} from "./types";
import type { PayPalEnvironment, PayPalOrderSummary } from "./paypal";
import {
  capturePayPalOrder,
  fetchPayPalAccessToken,
  fetchPayPalOrder,
} from "./paypal";
import { logger } from "./logger";
import { recordPayPalDonationPayment } from "./firestoreMembership";

export type VerifyDonationDeps = {
  db: AdminFirestore.Firestore;
  now: AdminFirestore.FieldValue;
  paypal: {
    env: PayPalEnvironment;
    clientId: string;
    clientSecret: string;
    fetchImpl?: typeof fetch;
  };
};

export async function verifyAndRecordDonationPayment(params: {
  uid: string;
  request: VerifyAndRecordPayPalDonationRequest;
  deps: VerifyDonationDeps;
}): Promise<VerifyAndRecordPayPalDonationResponse> {
  const { uid, request, deps } = params;
  logger.info("verifyAndRecordDonationPayment: start", {
    uid,
    orderId: request.orderId,
    year: request.year,
  });

  const accessToken = await fetchPayPalAccessToken({
    env: deps.paypal.env,
    clientId: deps.paypal.clientId,
    clientSecret: deps.paypal.clientSecret,
    fetchImpl: deps.paypal.fetchImpl,
  });

  logger.info("verifyAndRecordDonationPayment: fetched PayPal access token", {
    uid,
    orderId: request.orderId,
  });

  let order: PayPalOrderSummary = await fetchPayPalOrder({
    env: deps.paypal.env,
    accessToken,
    orderId: request.orderId,
    fetchImpl: deps.paypal.fetchImpl,
  });

  logger.info("verifyAndRecordDonationPayment: fetched PayPal order", {
    uid,
    orderId: order.id,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
  });

  if (!order.status) {
    throw new Error("PayPal order missing status");
  }

  if (order.status === "APPROVED") {
    logger.info("verifyAndRecordDonationPayment: capturing approved order", {
      uid,
      orderId: request.orderId,
    });

    order = await capturePayPalOrder({
      env: deps.paypal.env,
      accessToken,
      orderId: request.orderId,
      fetchImpl: deps.paypal.fetchImpl,
    });

    logger.info("verifyAndRecordDonationPayment: captured PayPal order", {
      uid,
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
    });
  }

  const paypalStatus = order.status;
  const amount = order.amount;
  const currency = order.currency;

  if (!paypalStatus) {
    throw new Error("PayPal order missing status after capture attempt");
  }

  if (paypalStatus !== "COMPLETED") {
    logger.warn("verifyAndRecordDonationPayment: non-completed PayPal status", {
      uid,
      orderId: request.orderId,
      paypalStatus,
    });

    return {
      ok: false,
      paypalStatus,
      amount,
      currency,
    };
  }

  logger.info("verifyAndRecordDonationPayment: recording donation", {
    uid,
    orderId: request.orderId,
    year: request.year,
  });

  const { reused } = await recordPayPalDonationPayment({
    db: deps.db,
    now: deps.now,
    payment: {
      uid,
      year: request.year,
      amount,
      currency,
      paypalStatus,
      orderId: request.orderId,
    },
  });

  logger.info("verifyAndRecordDonationPayment: recorded donation", {
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
