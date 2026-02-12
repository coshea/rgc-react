import { afterEach, describe, expect, it } from "vitest";

import { AuthError, getUidFromRequest } from "../httpUtils";

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

  it("rejects emulator token missing emulator_auth claim", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
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
});
