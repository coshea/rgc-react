"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAndRecordPayPalMembershipPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// Keep in sync with src/config/membership-pricing.ts defaults
const DEFAULT_MEMBERSHIP_FEE = 85;
const DEFAULT_HANDICAP_FEE = 50;
const PAYPAL_CLIENT_ID = (0, params_1.defineSecret)("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = (0, params_1.defineSecret)("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = (0, params_1.defineSecret)("PAYPAL_ENVIRONMENT"); // SANDBOX | LIVE
function paypalBaseUrl(environment) {
    const env = (environment || "SANDBOX").trim().toUpperCase();
    return env === "LIVE"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}
async function getPayPalAccessToken(params) {
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
    const json = (await resp.json());
    if (!json.access_token)
        throw new Error("PayPal token missing access_token");
    return json.access_token;
}
async function getPayPalOrder(params) {
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
    return (await resp.json());
}
function parseAmount(value) {
    if (!value)
        return null;
    const n = Number(value);
    if (!Number.isFinite(n))
        return null;
    return n;
}
function amountsEqual(a, b) {
    // PayPal uses 2 decimal places; tolerate tiny float drift
    return Math.abs(a - b) < 0.001;
}
async function expectedAmountFor(params) {
    const { purpose } = params;
    const settingsSnap = await db.doc("config/membershipSettings").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : null;
    if (purpose === "renew") {
        const v = settings?.fullMembershipPrice;
        return typeof v === "number" && Number.isFinite(v)
            ? v
            : DEFAULT_MEMBERSHIP_FEE;
    }
    const v = settings?.handicapMembershipPrice;
    return typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_HANDICAP_FEE;
}
function paymentDocId(userId, year) {
    return `${userId}_${year}`;
}
exports.verifyAndRecordPayPalMembershipPayment = (0, https_1.onCall)({
    region: "us-central1",
    secrets: [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT],
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Login required");
    const data = request.data;
    const orderId = (data.orderId || "").trim();
    const year = typeof data.year === "number" ? data.year : NaN;
    const membershipType = data.membershipType;
    const purpose = data.purpose;
    if (!orderId)
        throw new https_1.HttpsError("invalid-argument", "Missing orderId");
    if (!Number.isInteger(year) || year < 2000 || year > 3000) {
        throw new https_1.HttpsError("invalid-argument", "Invalid year");
    }
    if (membershipType !== "full" && membershipType !== "handicap") {
        throw new https_1.HttpsError("invalid-argument", "Invalid membershipType");
    }
    if (purpose !== "renew" && purpose !== "handicap") {
        throw new https_1.HttpsError("invalid-argument", "Invalid purpose");
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
        throw new https_1.HttpsError("failed-precondition", `PayPal order is not completed (status=${order.status})`);
    }
    const unit = order.purchase_units?.[0];
    const currency = unit?.amount?.currency_code || unit?.payments?.captures?.[0]?.amount?.currency_code;
    const value = unit?.amount?.value || unit?.payments?.captures?.[0]?.amount?.value;
    const amount = parseAmount(value);
    if (!currency || currency !== "USD") {
        throw new https_1.HttpsError("failed-precondition", `Unexpected currency (currency=${currency || "(missing)"})`);
    }
    if (amount == null) {
        throw new https_1.HttpsError("failed-precondition", "Missing PayPal amount");
    }
    const expectedAmount = await expectedAmountFor({ year, purpose });
    if (!amountsEqual(amount, expectedAmount)) {
        throw new https_1.HttpsError("failed-precondition", `Unexpected amount (expected=${expectedAmount}, actual=${amount})`);
    }
    const expectedCustomId = `${uid}:${year}:${membershipType}:${purpose}`;
    if ((unit?.custom_id || "").trim() !== expectedCustomId) {
        throw new https_1.HttpsError("failed-precondition", "PayPal order metadata mismatch");
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
            paidAt: firestore_1.FieldValue.serverTimestamp(),
            amount,
            method: "paypal",
            membershipType,
            recordedBy: uid,
            status: "confirmed",
            paypalOrderId: order.id,
            paypalCaptureId: capture?.id || null,
            paypalPayerEmail: order.payer?.email_address || null,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await db.doc(`users/${uid}`).set({
            lastPaidYear: year,
            membershipType,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return {
        ok: true,
        reused: existing.exists,
        paypalStatus: order.status,
        amount,
        currency,
    };
});
