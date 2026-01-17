#!/usr/bin/env node

const AUTH_EMULATOR = process.env.AUTH_EMULATOR ?? "http://127.0.0.1:9099";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "ridgefield-golf-club";
const REGION = process.env.FUNCTIONS_REGION ?? "us-central1";
const FUNCTIONS_EMULATOR =
  process.env.FUNCTIONS_EMULATOR ?? "http://127.0.0.1:5001";

const email = process.env.TEST_EMAIL ?? "test@example.com";
const password = process.env.TEST_PASSWORD ?? "password123";

const orderId = process.env.ORDER_ID ?? "ORDER123";
const year = Number(process.env.YEAR ?? "2026");
const membershipType = process.env.MEMBERSHIP_TYPE ?? "full";
const purpose = process.env.PURPOSE ?? "renew";

function requireOk(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

async function postJson(url, body, headers = {}) {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text().catch(() => "");
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { resp, text, json };
}

async function ensureUserExists() {
  // Auth emulator ignores API key but still requires it to be present.
  const url = `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key`;
  const { resp, json } = await postJson(url, {
    email,
    password,
    returnSecureToken: true,
  });

  // If already exists, emulator returns 400 EMAIL_EXISTS. That's OK.
  if (resp.ok) return;
  const message = json?.error?.message;
  if (message === "EMAIL_EXISTS") return;

  throw new Error(`Sign-up failed: ${resp.status} ${JSON.stringify(json)}`);
}

async function signInGetIdToken() {
  const url = `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`;
  const { resp, json, text } = await postJson(url, {
    email,
    password,
    returnSecureToken: true,
  });

  if (!resp.ok) {
    throw new Error(`Sign-in failed: ${resp.status} ${text}`);
  }

  const token = json?.idToken;
  requireOk(
    typeof token === "string" && token.length > 10,
    "Missing idToken from sign-in response"
  );
  return token;
}

async function callVerifyAndRecord(idToken) {
  const url = `${FUNCTIONS_EMULATOR}/${PROJECT_ID}/${REGION}/verify_and_record_membership_payment`;
  const payload = {
    orderId,
    year,
    membershipType,
    purpose,
  };

  const { resp, text, json } = await postJson(url, payload, {
    Authorization: `Bearer ${idToken}`,
  });

  const out = {
    url,
    status: resp.status,
    ok: resp.ok,
    response: json ?? text,
  };

  return out;
}

async function main() {
  requireOk(Number.isFinite(year), "YEAR must be a number");

  console.log("Using:");
  console.log(`- AUTH_EMULATOR=${AUTH_EMULATOR}`);
  console.log(`- FUNCTIONS_EMULATOR=${FUNCTIONS_EMULATOR}`);
  console.log(`- PROJECT_ID=${PROJECT_ID}`);
  console.log(`- REGION=${REGION}`);
  console.log(`- TEST_EMAIL=${email}`);

  await ensureUserExists();
  const token = await signInGetIdToken();
  const result = await callVerifyAndRecord(token);

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("\nFAILED:");
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
