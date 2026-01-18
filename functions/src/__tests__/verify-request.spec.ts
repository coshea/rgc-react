import { describe, expect, it } from "vitest";

import { parseVerifyRequest } from "../validate";

describe("parseVerifyRequest", () => {
  it("parses a valid body", () => {
    const req = parseVerifyRequest({
      orderId: "ABC",
      year: 2026,
      membershipType: "full",
      purpose: "renew",
    });

    expect(req).toEqual({
      orderId: "ABC",
      year: 2026,
      membershipType: "full",
      purpose: "renew",
    });
  });

  it("rejects invalid membershipType", () => {
    expect(() =>
      parseVerifyRequest({
        orderId: "ABC",
        year: 2026,
        membershipType: "vip",
        purpose: "renew",
      })
    ).toThrow(/membershipType/i);
  });
});
