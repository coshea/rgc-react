import fs from "node:fs";
import path from "node:path";

import * as admin from "firebase-admin";
import type { firestore as AdminFirestore } from "firebase-admin";
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

let emulatorLocalEnvCache: Record<string, string> | null | undefined;

function stripOptionalQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseDotEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = rawLine.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = rawLine.slice(0, equalsIndex).trim();
    const value = rawLine.slice(equalsIndex + 1);
    if (!key) continue;

    parsed[key] = stripOptionalQuotes(value);
  }

  return parsed;
}

function readEmulatorLocalEnv(): Record<string, string> | null {
  if (emulatorLocalEnvCache !== undefined) return emulatorLocalEnvCache;
  if (!isFunctionsEmulator()) {
    emulatorLocalEnvCache = null;
    return emulatorLocalEnvCache;
  }

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "../.env.local"),
  ];

  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, "utf8");
      emulatorLocalEnvCache = parseDotEnvFile(content);
      return emulatorLocalEnvCache;
    } catch {
      continue;
    }
  }

  emulatorLocalEnvCache = null;
  return emulatorLocalEnvCache;
}

export function resolveConfiguredValue(
  name: string,
  value: string | undefined,
): string | undefined {
  const localOverride = readEmulatorLocalEnv()?.[name];
  return localOverride ?? process.env[name] ?? value;
}

export function resetConfiguredValueCacheForTests(): void {
  emulatorLocalEnvCache = undefined;
}

export type FirestoreWriteTime =
  | AdminFirestore.FieldValue
  | AdminFirestore.Timestamp
  | Date;

export function getFirestoreWriteTime(): FirestoreWriteTime {
  const firestoreNamespace = admin.firestore as unknown as {
    FieldValue?: {
      serverTimestamp?: () => AdminFirestore.FieldValue;
    };
    Timestamp?: {
      now?: () => AdminFirestore.Timestamp;
    };
  };

  const serverTimestamp = firestoreNamespace.FieldValue?.serverTimestamp;
  if (typeof serverTimestamp === "function") {
    return serverTimestamp();
  }

  const timestampNow = firestoreNamespace.Timestamp?.now;
  if (typeof timestampNow === "function") {
    return timestampNow();
  }

  return new Date();
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
  aud?: string;
  iss?: string;
  firebase?: unknown;
  [key: string]: unknown;
};

const EMULATOR_AUTH_CLAIM_KEY = "emulator_auth";
const EMULATOR_AUTH_CLAIM_VALUE = "rgc-functions-emulator-only";
const FIREBASE_ISSUER_PREFIX = "https://securetoken.google.com/";

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

function parseFirebaseConfigProjectId(): string | null {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { projectId?: unknown };
    return typeof parsed.projectId === "string" && parsed.projectId.trim()
      ? parsed.projectId.trim()
      : null;
  } catch {
    return null;
  }
}

function getConfiguredProjectIds(): string[] {
  const values = [
    process.env.GCLOUD_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT,
    parseFirebaseConfigProjectId(),
  ];

  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      unique.add(value.trim());
    }
  }

  return [...unique];
}

function hasLegacyEmulatorAuthClaim(payload: JwtPayload): boolean {
  return payload[EMULATOR_AUTH_CLAIM_KEY] === EMULATOR_AUTH_CLAIM_VALUE;
}

function isStandardFirebaseEmulatorToken(payload: JwtPayload): boolean {
  const aud = typeof payload.aud === "string" ? payload.aud.trim() : "";
  const iss = typeof payload.iss === "string" ? payload.iss.trim() : "";
  const firebaseClaim = payload.firebase;

  if (!aud || !iss) return false;
  if (typeof firebaseClaim !== "object" || firebaseClaim === null) return false;

  const projectIds = getConfiguredProjectIds();
  if (projectIds.length > 0) {
    return projectIds.some(
      (projectId) =>
        aud === projectId && iss === `${FIREBASE_ISSUER_PREFIX}${projectId}`,
    );
  }

  return iss.startsWith(FIREBASE_ISSUER_PREFIX);
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

    if (
      !hasLegacyEmulatorAuthClaim(payload) &&
      !isStandardFirebaseEmulatorToken(payload)
    ) {
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
