import * as admin from "firebase-admin";
import cors from "cors";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";

import { parseVerifyRequest } from "./validate";
import { verifyAndRecordMembershipPayment } from "./verifyAndRecordMembershipPayment";

const PAYPAL_CLIENT_ID = defineString("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENV = defineString("PAYPAL_ENVIRONMENT");

admin.initializeApp();

const corsMiddleware = cors({
  origin: true,
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["content-type", "authorization"],
});

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) throw new Error(`Missing ${name}`);
  return value.trim();
}

function getBearerToken(req: {
  headers: Record<string, unknown>;
}): string | null {
  const raw = req.headers.authorization;
  if (typeof raw !== "string") return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isFunctionsEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

function mockPayPalFetchFromEnv(): typeof fetch | null {
  if (!isFunctionsEmulator()) return null;

  const status = process.env.PAYPAL_MOCK_STATUS;
  if (!status) return null;

  const amountRaw = process.env.PAYPAL_MOCK_AMOUNT;
  const currency = process.env.PAYPAL_MOCK_CURRENCY ?? "USD";

  const amount = amountRaw ? Number(amountRaw) : 100;
  const value = Number.isFinite(amount) ? amount.toFixed(2) : "100.00";

  const fetchImpl: typeof fetch = async (url) => {
    const u = String(url);
    if (u.includes("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "mock-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (u.includes("/v2/checkout/orders/")) {
      return new Response(
        JSON.stringify({
          id: "MOCK_ORDER",
          status,
          purchase_units: [
            {
              amount: {
                currency_code: currency,
                value,
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };

  return fetchImpl;
}

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

      try {
        const token = getBearerToken(
          req as unknown as { headers: Record<string, unknown> },
        );
        if (!token) {
          res
            .status(401)
            .json({ ok: false, error: "Missing Authorization token" });
          return;
        }

        // In emulator mode the Auth emulator issues unsigned or test tokens
        // which the Admin SDK cannot verify via signature checks. For local
        // development we decode the JWT payload without verification to
        // extract the `uid`. This is safe for emulator-only runs because
        // the functions are not exposed to real clients.
        function decodeJwtNoVerify(t: string): unknown | null {
          try {
            const parts = t.split(".");
            if (parts.length < 2) return null;
            const payload = parts[1];
            const json = Buffer.from(payload, "base64").toString("utf8");
            return JSON.parse(json) as unknown;
          } catch {
            return null;
          }
        }

        type JwtPayload = {
          uid?: string;
          user_id?: string;
          sub?: string;
          [key: string]: unknown;
        };

        function isJwtPayload(value: unknown): value is JwtPayload {
          if (typeof value !== "object" || value === null) return false;
          const rec = value as Record<string, unknown>;
          const uid = rec["uid"];
          const userId = rec["user_id"];
          const sub = rec["sub"];
          return (
            (typeof uid === "string" && uid.length > 0) ||
            (typeof userId === "string" && userId.length > 0) ||
            (typeof sub === "string" && sub.length > 0)
          );
        }

        let uid: string;
        if (isFunctionsEmulator()) {
          const payload = decodeJwtNoVerify(token);
          if (!isJwtPayload(payload)) {
            res
              .status(401)
              .json({ ok: false, error: "Invalid emulator token payload" });
            return;
          }

          uid = payload.uid ?? payload.user_id ?? payload.sub ?? "";
          if (!uid) {
            res
              .status(401)
              .json({ ok: false, error: "Invalid emulator token payload" });
            return;
          }
        } else {
          const decoded = await admin.auth().verifyIdToken(token);
          uid = decoded.uid;
        }

        const request = parseVerifyRequest(req.body);

        const clientId = required("PAYPAL_CLIENT_ID", PAYPAL_CLIENT_ID.value());
        const clientSecret = required(
          "PAYPAL_CLIENT_SECRET",
          PAYPAL_CLIENT_SECRET.value(),
        );
        const envRaw = required(
          "PAYPAL_ENVIRONMENT",
          PAYPAL_ENV.value(),
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
        res.status(500).json({ ok: false, error: message });
      }
    });
  },
);
