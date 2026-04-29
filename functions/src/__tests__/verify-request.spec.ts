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
      }),
    ).toThrow(/membershipType/i);
  });

  it("accepts 'new' as a valid purpose", () => {
    const req = parseVerifyRequest({
      orderId: "ABC",
      year: 2026,
      membershipType: "full",
      purpose: "new",
    });

    expect(req).toEqual({
      orderId: "ABC",
      year: 2026,
      membershipType: "full",
      purpose: "new",
    });
  });

  it("rejects 'donation' as an invalid purpose", () => {
    expect(() =>
      parseVerifyRequest({
        orderId: "ABC",
        year: 2026,
        membershipType: "full",
        purpose: "donation",
      }),
    ).toThrow(/purpose/i);
  });
});
