import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

const db = getFirestore();

// Keep in sync with src/config/membership-pricing.ts defaults
const DEFAULT_MEMBERSHIP_FEE = 85;
const DEFAULT_HANDICAP_FEE = 50;

const PAYPAL_CLIENT_ID = defineSecret("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = defineSecret("PAYPAL_ENVIRONMENT"); // SANDBOX | LIVE

type MembershipType = "full" | "handicap";

type VerifyAndRecordRequest = {
  orderId: string;
  year: number;
  membershipType: MembershipType;
  purpose: "renew" | "handicap";
};

type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{
    amount?: { currency_code?: string; value?: string };
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
  payer?: {
    email_address?: string;
    payer_id?: string;
    name?: { given_name?: string; surname?: string };
  };
};

function paypalBaseUrl(environment: string | undefined): string {
  const env = (environment || "SANDBOX").trim().toUpperCase();
  return env === "LIVE"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalAccessToken(params: {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}): Promise<string> {
  const { clientId, clientSecret, baseUrl } = params;

  const tokenUrl = `${baseUrl}/v1/oauth2/token`;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`PayPal token request failed: ${resp.status} ${text}`);
  }

  const json = (await resp.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal token missing access_token");
  return json.access_token;
}

async function getPayPalOrder(params: {
  baseUrl: string;
  accessToken: string;
  orderId: string;
}): Promise<PayPalOrder> {
  const { baseUrl, accessToken, orderId } = params;
  const resp = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`PayPal get order failed: ${resp.status} ${text}`);
  }

  return (await resp.json()) as PayPalOrder;
}

function parseAmount(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function amountsEqual(a: number, b: number): boolean {
  // PayPal uses 2 decimal places; tolerate tiny float drift
  return Math.abs(a - b) < 0.001;
}

async function expectedAmountFor(params: {
  year: number;
  purpose: "renew" | "handicap";
}): Promise<number> {
  const { purpose } = params;
  const settingsSnap = await db.doc("config/membershipSettings").get();
  const settings = settingsSnap.exists ? (settingsSnap.data() as any) : null;

  if (purpose === "renew") {
    const v = settings?.fullMembershipPrice;
    return typeof v === "number" && Number.isFinite(v)
      ? v
      : DEFAULT_MEMBERSHIP_FEE;
  }

  const v = settings?.handicapMembershipPrice;
  return typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_HANDICAP_FEE;
}

function paymentDocId(userId: string, year: number) {
  return `${userId}_${year}`;
}

export const verifyAndRecordPayPalMembershipPayment = onCall(
  {
    region: "us-central1",
    secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");

    const data = request.data as Partial<VerifyAndRecordRequest>;
    const orderId = (data.orderId || "").trim();
    const year = typeof data.year === "number" ? data.year : NaN;
    const membershipType = data.membershipType;
    const purpose = data.purpose;

    if (!orderId) throw new HttpsError("invalid-argument", "Missing orderId");
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
      throw new HttpsError("invalid-argument", "Invalid year");
    }
    if (membershipType !== "full" && membershipType !== "handicap") {
      throw new HttpsError("invalid-argument", "Invalid membershipType");
    }
    if (purpose !== "renew" && purpose !== "handicap") {
      throw new HttpsError("invalid-argument", "Invalid purpose");
    }

    const env = PAYPAL_ENVIRONMENT.value();
    const baseUrl = paypalBaseUrl(env);

    const accessToken = await getPayPalAccessToken({
      clientId: PAYPAL_CLIENT_ID.value(),
      clientSecret: PAYPAL_CLIENT_SECRET.value(),
      baseUrl,
    });

    const order = await getPayPalOrder({ baseUrl, accessToken, orderId });

    if (order.status !== "COMPLETED") {
      throw new HttpsError(
        "failed-precondition",
        `PayPal order is not completed (status=${order.status})`
      );
    }

    const unit = order.purchase_units?.[0];
    const currency =
      unit?.amount?.currency_code ||
      unit?.payments?.captures?.[0]?.amount?.currency_code;
    const value =
      unit?.amount?.value || unit?.payments?.captures?.[0]?.amount?.value;
    const amount = parseAmount(value);

    if (!currency || currency !== "USD") {
      throw new HttpsError(
        "failed-precondition",
        `Unexpected currency (currency=${currency || "(missing)"})`
      );
    }

    if (amount == null) {
      throw new HttpsError("failed-precondition", "Missing PayPal amount");
    }

    const expectedAmount = await expectedAmountFor({ year, purpose });
    if (!amountsEqual(amount, expectedAmount)) {
      throw new HttpsError(
        "failed-precondition",
        `Unexpected amount (expected=${expectedAmount}, actual=${amount})`
      );
    }

    const expectedCustomId = `${uid}:${year}:${membershipType}:${purpose}`;
    if ((unit?.custom_id || "").trim() !== expectedCustomId) {
      throw new HttpsError(
        "failed-precondition",
        "PayPal order metadata mismatch"
      );
    }

    // Idempotent write: if a payment record already exists, do not overwrite.
    const paymentId = paymentDocId(uid, year);
    const paymentRef = db.doc(`memberPayments/${paymentId}`);
    const existing = await paymentRef.get();

    if (!existing.exists) {
      const capture = unit?.payments?.captures?.[0];

      await paymentRef.set({
        userId: uid,
        year,
        paidAt: FieldValue.serverTimestamp(),
        amount,
        method: "paypal",
        membershipType,
        recordedBy: uid,
        status: "confirmed",
        paypalOrderId: order.id,
        paypalCaptureId: capture?.id || null,
        paypalPayerEmail: order.payer?.email_address || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db.doc(`users/${uid}`).set(
        {
          lastPaidYear: year,
          membershipType,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return {
      ok: true,
      reused: existing.exists,
      paypalStatus: order.status,
      amount,
      currency,
    };
  }
);
