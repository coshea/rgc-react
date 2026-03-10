import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AuthError,
  getUidFromRequest,
  resetConfiguredValueCacheForTests,
  resolveConfiguredValue,
} from "../httpUtils";
import {
  PAYPAL_CLIENT_ID_NAME,
  PAYPAL_ENVIRONMENT_NAME,
} from "../paypalConfig";

const originalCwd = process.cwd();
const originalFunctionsEmulator = process.env.FUNCTIONS_EMULATOR;
const originalPayPalClientId = process.env.PAYPAL_CLIENT_ID;
const originalGcloudProject = process.env.GCLOUD_PROJECT;
const originalGoogleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
const originalFirebaseConfig = process.env.FIREBASE_CONFIG;

afterEach(() => {
  process.chdir(originalCwd);

  if (originalFunctionsEmulator === undefined) {
    delete process.env.FUNCTIONS_EMULATOR;
  } else {
    process.env.FUNCTIONS_EMULATOR = originalFunctionsEmulator;
  }

  if (originalPayPalClientId === undefined) {
    delete process.env.PAYPAL_CLIENT_ID;
  } else {
    process.env.PAYPAL_CLIENT_ID = originalPayPalClientId;
  }

  if (originalGcloudProject === undefined) {
    delete process.env.GCLOUD_PROJECT;
  } else {
    process.env.GCLOUD_PROJECT = originalGcloudProject;
  }

  if (originalGoogleCloudProject === undefined) {
    delete process.env.GOOGLE_CLOUD_PROJECT;
  } else {
    process.env.GOOGLE_CLOUD_PROJECT = originalGoogleCloudProject;
  }

  if (originalFirebaseConfig === undefined) {
    delete process.env.FIREBASE_CONFIG;
  } else {
    process.env.FIREBASE_CONFIG = originalFirebaseConfig;
  }

  resetConfiguredValueCacheForTests();
});

describe("resolveConfiguredValue", () => {
  it("prefers .env.local values in the functions emulator", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rgc-paypal-"));
    fs.writeFileSync(
      path.join(tempDir, ".env.local"),
      [
        "PAYPAL_CLIENT_ID=local-sandbox-client",
        "PAYPAL_CLIENT_SECRET=local-sandbox-secret",
      ].join("\n"),
      "utf8",
    );

    process.chdir(tempDir);
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.PAYPAL_CLIENT_ID = "project-scoped-client";

    expect(resolveConfiguredValue(PAYPAL_CLIENT_ID_NAME, "param-client")).toBe(
      "local-sandbox-client",
    );
  });

  it("falls back to process env or param values outside local override", () => {
    process.env.FUNCTIONS_EMULATOR = "false";
    process.env.PAYPAL_CLIENT_ID = "process-client";

    expect(resolveConfiguredValue(PAYPAL_CLIENT_ID_NAME, "param-client")).toBe(
      "process-client",
    );
    expect(resolveConfiguredValue(PAYPAL_ENVIRONMENT_NAME, "SANDBOX")).toBe(
      "SANDBOX",
    );
  });
});

function toBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = { alg: "none", typ: "JWT" };
  return `${toBase64Url(header)}.${toBase64Url(payload)}.`;
}

describe("getUidFromRequest emulator hardening", () => {
  const originalEmulator = process.env.FUNCTIONS_EMULATOR;

  afterEach(() => {
    if (originalEmulator === undefined) {
      delete process.env.FUNCTIONS_EMULATOR;
    } else {
      process.env.FUNCTIONS_EMULATOR = originalEmulator;
    }
  });

  it("rejects emulator token missing expected emulator markers", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.GCLOUD_PROJECT = "ridgefield-golf-club";
    const token = makeUnsignedJwt({ uid: "uid-123" });

    await expect(
      getUidFromRequest({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).rejects.toThrow(AuthError);

    await expect(
      getUidFromRequest({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).rejects.toThrow("Invalid emulator auth claim");
  });

  it("accepts emulator token with required emulator_auth claim", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    const token = makeUnsignedJwt({
      uid: "uid-456",
      emulator_auth: "rgc-functions-emulator-only",
    });

    await expect(
      getUidFromRequest({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).resolves.toBe("uid-456");
  });

  it("accepts standard Firebase emulator tokens for the active project", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.GCLOUD_PROJECT = "ridgefield-golf-club";

    const token = makeUnsignedJwt({
      aud: "ridgefield-golf-club",
      iss: "https://securetoken.google.com/ridgefield-golf-club",
      sub: "uid-789",
      user_id: "uid-789",
      firebase: { sign_in_provider: "password" },
    });

    await expect(
      getUidFromRequest({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).resolves.toBe("uid-789");
  });

  it("rejects standard Firebase emulator tokens for the wrong project", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    process.env.GCLOUD_PROJECT = "ridgefield-golf-club";

    const token = makeUnsignedJwt({
      aud: "other-project",
      iss: "https://securetoken.google.com/other-project",
      sub: "uid-999",
      user_id: "uid-999",
      firebase: { sign_in_provider: "password" },
    });

    await expect(
      getUidFromRequest({
        headers: { authorization: `Bearer ${token}` },
      }),
    ).rejects.toThrow("Invalid emulator auth claim");
  });
});
