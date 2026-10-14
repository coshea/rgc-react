import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

import { shouldReportError } from "../sentry";

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
