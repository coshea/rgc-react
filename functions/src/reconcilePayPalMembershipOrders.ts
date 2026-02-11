import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";

import { fetchPayPalAccessToken, fetchPayPalTransactions } from "./paypal";
import { verifyAndRecordMembershipPayment } from "./verifyAndRecordMembershipPayment";
import { logger } from "./logger";
import { MEMBERSHIP_TYPES } from "./types";
import type { MembershipType, ReconcilePayPalOrdersResponse } from "./types";
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

function parseMembershipCustomId(value: string): {
  uid: string;
  year: number;
  membershipType: MembershipType;
  purpose: "renew" | "handicap";
} | null {
  const parts = value.split(":").map((part) => part.trim());
  if (parts.length < 4) return null;
  const [uid, yearRaw, membershipTypeRaw, purposeRaw] = parts;
  if (!uid) return null;
  const year = Number(yearRaw);
  if (!Number.isFinite(year)) return null;

  const membershipType =
    membershipTypeRaw === MEMBERSHIP_TYPES.FULL
      ? MEMBERSHIP_TYPES.FULL
      : membershipTypeRaw === MEMBERSHIP_TYPES.HANDICAP
        ? MEMBERSHIP_TYPES.HANDICAP
        : null;
  if (!membershipType) return null;

  if (purposeRaw !== "renew" && purposeRaw !== "handicap") return null;

  return {
    uid,
    year,
    membershipType,
    purpose: purposeRaw,
  };
}

async function requireAdminUser(uid: string): Promise<void> {
  const snap = await admin.firestore().collection("admin").doc(uid).get();
  if (!snap.exists) {
    throw new AuthError("Admin access required", 403);
  }
  const data = snap.data() as Record<string, unknown> | undefined;
  const isAdmin =
    data?.isAdmin === true || data?.admin === true || data?.admin === "true";
  if (!isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
}

export const reconcile_paypal_membership_orders = onRequest(
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
      const response: ReconcilePayPalOrdersResponse = {
        ok: true,
        scanned: 0,
        processed: 0,
        skipped: 0,
        skippedItems: [],
        errors: [],
      };

      try {
        uid = await getUidFromRequest(
          req as unknown as { headers: Record<string, unknown> },
        );
        await requireAdminUser(uid);

        const clientIdValue = PAYPAL_CLIENT_ID.value();
        const clientSecretValue = PAYPAL_CLIENT_SECRET.value();
        const envValue = PAYPAL_ENVIRONMENT.value();

        logger.info(
          "reconcile_paypal_membership_orders: PayPal config present",
          {
            hasClientId: Boolean(clientIdValue && clientIdValue.trim()),
            hasClientSecret: Boolean(clientSecretValue),
            hasEnvironment: Boolean(envValue && envValue.trim()),
            // clientIdValue: clientSecretValue
            //   ? clientIdValue.slice(0, 4) + "..."
            //   : null,
            // clientSecretValue: clientSecretValue
            //   ? clientSecretValue.slice(0, 4) + "..."
            //   : null,
            envValue,
          },
        );

        const clientId = required("PAYPAL_CLIENT_ID", clientIdValue);
        const clientSecret = required(
          "PAYPAL_CLIENT_SECRET",
          clientSecretValue,
        );
        const envRaw = required("PAYPAL_ENVIRONMENT", envValue).toUpperCase();
        const env = envRaw === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

        const fetchImpl = mockPayPalFetchFromEnv() ?? undefined;
        const accessToken = await fetchPayPalAccessToken({
          env,
          clientId,
          clientSecret,
          fetchImpl,
        });

        const now = new Date();
        const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const transactions = await fetchPayPalTransactions({
          env,
          accessToken,
          startDate: start.toISOString(),
          endDate: now.toISOString(),
          fetchImpl,
        });

        response.scanned = transactions.length;

        const serverNow =
          typeof admin.firestore.FieldValue?.serverTimestamp === "function"
            ? admin.firestore.FieldValue.serverTimestamp()
            : admin.firestore.Timestamp.now();

        for (const tx of transactions) {
          const orderId = tx.paypalReferenceId ?? tx.transactionId ?? null;
          const customId = tx.customId ?? null;

          if (!orderId) {
            response.skipped += 1;
            response.skippedItems.push({
              orderId: null,
              customId,
              reason: "Missing PayPal order id",
            });
            continue;
          }

          if (!customId) {
            response.skipped += 1;
            response.skippedItems.push({
              orderId,
              customId: null,
              reason: "Missing membership custom_id",
            });
            continue;
          }

          const parsed = parseMembershipCustomId(customId);
          if (!parsed) {
            response.skipped += 1;
            response.skippedItems.push({
              orderId,
              customId,
              reason: "Unrecognized custom_id format",
            });
            continue;
          }

          const orderSnap = await admin
            .firestore()
            .collection("paypalOrders")
            .doc(orderId)
            .get();
          if (orderSnap.exists) {
            response.skipped += 1;
            response.skippedItems.push({
              orderId,
              customId,
              reason: "Already recorded",
            });
            continue;
          }

          try {
            const verifyResp = await verifyAndRecordMembershipPayment({
              uid: parsed.uid,
              request: {
                orderId,
                year: parsed.year,
                membershipType: parsed.membershipType,
                purpose: parsed.purpose,
              },
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

            if (!verifyResp.ok) {
              response.skipped += 1;
              response.skippedItems.push({
                orderId,
                customId,
                reason: `PayPal status ${verifyResp.paypalStatus ?? "unknown"}`,
              });
              continue;
            }

            response.processed += 1;
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "Unknown error";
            response.errors.push({ orderId, customId, error: message });
          }
        }

        res.status(200).json(response);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        logger.error("reconcile_paypal_membership_orders failed", {
          error: message,
          stack: e instanceof Error ? e.stack : undefined,
          uid,
          origin: req.headers.origin ?? null,
          host: req.headers.host ?? null,
        });
        const status = e instanceof AuthError ? e.status : 500;
        res.status(status).json({ ok: false, error: message });
      }
    });
  },
);
