import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

import { shouldReportError, toLogAttributes } from "../sentry";

describe("shouldReportError", () => {
  it("skips HttpsErrors that answer a bad or unauthorized request", () => {
    for (const code of [
      "unauthenticated",
      "permission-denied",
      "invalid-argument",
      "not-found",
    ] as const) {
      expect(shouldReportError(new HttpsError(code, "nope"))).toBe(false);
    }
  });

  it("reports server-side HttpsErrors and plain errors", () => {
    expect(shouldReportError(new HttpsError("internal", "boom"))).toBe(true);
    expect(shouldReportError(new HttpsError("unavailable", "down"))).toBe(true);
    expect(shouldReportError(new Error("boom"))).toBe(true);
  });
});

describe("toLogAttributes", () => {
  it("spreads a plain object's fields into attributes", () => {
    expect(
      toLogAttributes([{ uid: "u1", count: 3, ok: true, skipped: undefined }]),
    ).toEqual({ uid: "u1", count: 3, ok: true });
  });

  it("stringifies nested values and errors", () => {
    expect(
      toLogAttributes([{ ids: ["a", "b"], err: new TypeError("bad") }]),
    ).toEqual({ ids: '["a","b"]', err: "TypeError: bad" });
  });

  it("keeps non-object args as a detail string", () => {
    expect(toLogAttributes(["first", 2, new Error("boom")])).toEqual({
      detail: "first 2 Error: boom",
    });
  });

  it("returns no attributes for no detail", () => {
    expect(toLogAttributes([])).toEqual({});
  });
});
