import { describe, expect, it } from "vitest";

import { parsePayPalOrderSummary } from "../paypal";

describe("parsePayPalOrderSummary", () => {
  it("extracts id, status, amount and currency", () => {
    const order = {
      id: "ORDER123",
      status: "COMPLETED",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: "100.00",
          },
        },
      ],
    };

    expect(parsePayPalOrderSummary(order)).toEqual({
      id: "ORDER123",
      status: "COMPLETED",
      amount: 100,
      currency: "USD",
    });
  });

  it("throws on missing id", () => {
    expect(() => parsePayPalOrderSummary({ status: "COMPLETED" })).toThrow(
      /missing id/i
    );
  });
});
