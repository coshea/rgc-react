import { describe, expect, it } from "vitest";

import { verifyAndRecordMembershipPayment } from "../verifyAndRecordMembershipPayment";

describe("verifyAndRecordMembershipPayment", () => {
  it("returns ok=false when PayPal status not COMPLETED", async () => {
    // Dependency-inject fetch so PayPal calls are deterministic.
    const fetchImpl: typeof fetch = async (url, _init) => {
      const u = String(url);
      if (u.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (u.includes("/v2/checkout/orders/")) {
        return new Response(
          JSON.stringify({
            id: "ORDER123",
            status: "CREATED",
            purchase_units: [
              { amount: { currency_code: "USD", value: "100.00" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const resp = await verifyAndRecordMembershipPayment({
      uid: "uid1",
      request: {
        orderId: "ORDER123",
        year: 2026,
        membershipType: "full",
        purpose: "renew",
      },
      deps: {
        // db/now not used for non-completed status
        db: {} as unknown as import("firebase-admin").firestore.Firestore,
        now: {} as unknown as import("firebase-admin").firestore.FieldValue,
        paypal: {
          env: "SANDBOX",
          clientId: "id",
          clientSecret: "secret",
          fetchImpl,
        },
      },
    });

    expect(resp.ok).toBe(false);
    expect(resp.paypalStatus).toBe("CREATED");
    expect(resp.amount).toBe(100);
    expect(resp.currency).toBe("USD");
  });
});
