import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";

import {
  parseCheckPaymentRequest,
  parseDonationVerifyRequest,
  parseVerifyRequest,
} from "./validate";
import { verifyAndRecordMembershipPayment } from "./verifyAndRecordMembershipPayment";
import { recordCheckMembershipPayment } from "./firestoreMembership";
import { verifyAndRecordDonationPayment } from "./verifyAndRecordDonationPayment";
import { logger } from "./logger";
import {
  AuthError,
  corsMiddleware,
  getUidFromRequest,
  mockPayPalFetchFromEnv,
  required,
} from "./httpUtils";

const PAYPAL_CLIENT_ID = defineString("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = defineString("PAYPAL_ENVIRONMENT");

admin.initializeApp();

export const verify_and_record_membership_payment = onRequest(
  { secrets: [PAYPAL_CLIENT_SECRET] },
  async (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }

      let uid: string | null = null;
      let request: ReturnType<typeof parseVerifyRequest> | null = null;

      try {
        uid = await getUidFromRequest(
          req as unknown as { headers: Record<string, unknown> },
        );

        request = parseVerifyRequest(req.body);

        const clientId = required("PAYPAL_CLIENT_ID", PAYPAL_CLIENT_ID.value());
        const clientSecret = required(
          "PAYPAL_CLIENT_SECRET",
          PAYPAL_CLIENT_SECRET.value(),
        );
        const envRaw = required(
          "PAYPAL_ENVIRONMENT",
          PAYPAL_ENVIRONMENT.value(),
        ).toUpperCase();
        const env = envRaw === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

        const fetchImpl = mockPayPalFetchFromEnv() ?? undefined;

        // Support runtimes where `admin.firestore.FieldValue` may not be present
        // (emulator or differing admin SDK shapes). Prefer serverTimestamp
        // sentinel when available, otherwise use a concrete Timestamp.now().
        const serverNow =
          typeof admin.firestore.FieldValue?.serverTimestamp === "function"
            ? // FieldValue.serverTimestamp() is the preferred sentinel when
              // available.
              admin.firestore.FieldValue.serverTimestamp()
            : // Fall back to a concrete Timestamp for runtimes that don't
              // expose the FieldValue sentinel.
              admin.firestore.Timestamp.now();

        const resp = await verifyAndRecordMembershipPayment({
          uid,
          request,
          deps: {
            db: admin.firestore(),
            now: serverNow,
            paypal: {
              env,
              clientId,
              clientSecret,
              ...(fetchImpl ? { fetchImpl } : {}),
            },
          },
        });

        res.status(200).json(resp);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        logger.error("verify_and_record_membership_payment failed", {
          error: message,
          stack: e instanceof Error ? e.stack : undefined,
          uid,
          orderId: request?.orderId ?? null,
          year: request?.year ?? null,
          membershipType: request?.membershipType ?? null,
          purpose: request?.purpose ?? null,
          origin: req.headers.origin ?? null,
          host: req.headers.host ?? null,
        });
        if (e instanceof AuthError) {
          res.status(e.status).json({ ok: false, error: e.message });
          return;
        }
        res.status(500).json({ ok: false, error: message });
      }
    });
  },
);

export const request_check_membership_payment = onRequest(async (req, res) => {
  corsMiddleware(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    let uid: string | null = null;
    let request: ReturnType<typeof parseCheckPaymentRequest> | null = null;

    try {
      uid = await getUidFromRequest(
        req as unknown as { headers: Record<string, unknown> },
      );

      request = parseCheckPaymentRequest(req.body);

      const serverNow =
        typeof admin.firestore.FieldValue?.serverTimestamp === "function"
          ? admin.firestore.FieldValue.serverTimestamp()
          : admin.firestore.Timestamp.now();

      const { groupId, reused } = await recordCheckMembershipPayment({
        db: admin.firestore(),
        now: serverNow,
        payment: {
          uid,
          year: request.year,
          membershipType: request.membershipType,
          donationAmount: request.donationAmount,
          requestId: request.requestId,
        },
      });

      res.status(200).json({ ok: true, groupId, reused });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      logger.error("request_check_membership_payment failed", {
        error: message,
        stack: e instanceof Error ? e.stack : undefined,
        uid,
        year: request?.year ?? null,
        membershipType: request?.membershipType ?? null,
        donationAmount: request?.donationAmount ?? null,
        requestId: request?.requestId ?? null,
        origin: req.headers.origin ?? null,
        host: req.headers.host ?? null,
      });
      if (e instanceof AuthError) {
        res.status(e.status).json({ ok: false, error: e.message });
        return;
      }
      res.status(500).json({ ok: false, error: message });
    }
  });
});

export const verify_and_record_donation_payment = onRequest(
  { secrets: [PAYPAL_CLIENT_SECRET] },
  async (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Method not allowed" });
        return;
      }

      let uid: string | null = null;
      let request: ReturnType<typeof parseDonationVerifyRequest> | null = null;

      try {
        uid = await getUidFromRequest(
          req as unknown as { headers: Record<string, unknown> },
        );

        request = parseDonationVerifyRequest(req.body);

        const clientId = required("PAYPAL_CLIENT_ID", PAYPAL_CLIENT_ID.value());
        const clientSecret = required(
          "PAYPAL_CLIENT_SECRET",
          PAYPAL_CLIENT_SECRET.value(),
        );
        const envRaw = required(
          "PAYPAL_ENVIRONMENT",
          PAYPAL_ENVIRONMENT.value(),
        ).toUpperCase();
        const env = envRaw === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

        const fetchImpl = mockPayPalFetchFromEnv() ?? undefined;

        const serverNow =
          typeof admin.firestore.FieldValue?.serverTimestamp === "function"
            ? admin.firestore.FieldValue.serverTimestamp()
            : admin.firestore.Timestamp.now();

        const resp = await verifyAndRecordDonationPayment({
          uid,
          request,
          deps: {
            db: admin.firestore(),
            now: serverNow,
            paypal: {
              env,
              clientId,
              clientSecret,
              ...(fetchImpl ? { fetchImpl } : {}),
            },
          },
        });

        res.status(200).json(resp);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        logger.error("verify_and_record_donation_payment failed", {
          error: message,
          stack: e instanceof Error ? e.stack : undefined,
          uid,
          orderId: request?.orderId ?? null,
          year: request?.year ?? null,
          origin: req.headers.origin ?? null,
          host: req.headers.host ?? null,
        });
        if (e instanceof AuthError) {
          res.status(e.status).json({ ok: false, error: e.message });
          return;
        }
        res.status(500).json({ ok: false, error: message });
      }
    });
  },
);

export { reconcile_paypal_membership_orders } from "./reconcilePayPalMembershipOrders";
