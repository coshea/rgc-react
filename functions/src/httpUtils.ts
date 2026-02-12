import * as admin from "firebase-admin";
import cors from "cors";

export const corsMiddleware = cors({
  origin: true,
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["content-type", "authorization"],
});

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function required(name: string, value: string | undefined): string {
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

type JwtPayload = {
  uid?: string;
  user_id?: string;
  sub?: string;
  [key: string]: unknown;
};

const EMULATOR_AUTH_CLAIM_KEY = "emulator_auth";
const EMULATOR_AUTH_CLAIM_VALUE = "rgc-functions-emulator-only";

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtNoVerify(token: string): unknown | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const json = decodeBase64Url(payload);
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

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

export async function getUidFromRequest(req: {
  headers: Record<string, unknown>;
}): Promise<string> {
  const token = getBearerToken(req);
  if (!token) {
    throw new AuthError("Missing Authorization token");
  }

  if (isFunctionsEmulator()) {
    const payload = decodeJwtNoVerify(token);
    if (!isJwtPayload(payload)) {
      throw new AuthError("Invalid emulator token payload");
    }

    if (payload[EMULATOR_AUTH_CLAIM_KEY] !== EMULATOR_AUTH_CLAIM_VALUE) {
      throw new AuthError("Invalid emulator auth claim");
    }

    const uid = payload.uid ?? payload.user_id ?? payload.sub ?? "";
    if (!uid) {
      throw new AuthError("Invalid emulator token payload");
    }

    return uid;
  }

  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

function isFunctionsEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

export function mockPayPalFetchFromEnv(): typeof fetch | null {
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
    if (u.includes("/v1/reporting/transactions")) {
      return new Response(
        JSON.stringify({
          transaction_details: [],
          total_pages: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };

  return fetchImpl;
}
