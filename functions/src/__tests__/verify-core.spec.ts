import type { firestore as AdminFirestore } from "firebase-admin";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAndRecordDonationPayment } from "../verifyAndRecordDonationPayment";
import { verifyAndRecordMembershipPayment } from "../verifyAndRecordMembershipPayment";
import {
  recordPayPalDonationPayment,
  recordPayPalMembershipPayment,
} from "../firestoreMembership";

vi.mock("../firestoreMembership", async () => {
  const actual = await vi.importActual<typeof import("../firestoreMembership")>(
    "../firestoreMembership",
  );

  return {
    ...actual,
    recordPayPalDonationPayment: vi.fn(),
    recordPayPalMembershipPayment: vi.fn(),
  };
});

const recordPayPalDonationPaymentMock = vi.mocked(recordPayPalDonationPayment);
const recordPayPalMembershipPaymentMock = vi.mocked(
  recordPayPalMembershipPayment,
);

describe("verifyAndRecordMembershipPayment", () => {
  beforeEach(() => {
    recordPayPalMembershipPaymentMock.mockReset();
  });

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

  it("records COMPLETED membership orders without capture", async () => {
    recordPayPalMembershipPaymentMock.mockResolvedValue({ reused: false });

    const fetchImpl: typeof fetch = async (url, init) => {
      const requestUrl = String(url);

      if (requestUrl.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (
        requestUrl.includes("/v2/checkout/orders/ORDER123") &&
        init?.method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            id: "ORDER123",
            status: "COMPLETED",
            purchase_units: [
              { amount: { currency_code: "USD", value: "100.00" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    };

    const now = new Date("2026-03-08T00:00:00.000Z");

    const resp = await verifyAndRecordMembershipPayment({
      uid: "uid1",
      request: {
        orderId: "ORDER123",
        year: 2026,
        membershipType: "full",
        purpose: "renew",
      },
      deps: {
        db: {} as unknown as AdminFirestore.Firestore,
        now,
        paypal: {
          env: "SANDBOX",
          clientId: "id",
          clientSecret: "secret",
          fetchImpl,
        },
      },
    });

    expect(recordPayPalMembershipPaymentMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      now,
      payment: {
        uid: "uid1",
        year: 2026,
        membershipType: "full",
        purpose: "renew",
        amount: 100,
        currency: "USD",
        paypalStatus: "COMPLETED",
        orderId: "ORDER123",
      },
    });

    expect(resp).toEqual({
      ok: true,
      reused: false,
      paypalStatus: "COMPLETED",
      amount: 100,
      currency: "USD",
    });
  });

  it("captures APPROVED membership orders and uses the captured COMPLETED status", async () => {
    const requestedUrls: string[] = [];

    recordPayPalMembershipPaymentMock.mockResolvedValue({ reused: false });

    const fetchImpl: typeof fetch = async (url, init) => {
      const requestUrl = String(url);
      requestedUrls.push(`${init?.method ?? "GET"} ${requestUrl}`);

      if (requestUrl.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (
        requestUrl.includes("/v2/checkout/orders/ORDER123/capture") &&
        init?.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            id: "ORDER123",
            status: "COMPLETED",
            purchase_units: [
              { amount: { currency_code: "USD", value: "100.00" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        requestUrl.includes("/v2/checkout/orders/ORDER123") &&
        init?.method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            id: "ORDER123",
            status: "APPROVED",
            purchase_units: [
              { amount: { currency_code: "USD", value: "100.00" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    };

    const now = new Date("2026-03-08T00:00:00.000Z");

    const resp = await verifyAndRecordMembershipPayment({
      uid: "uid1",
      request: {
        orderId: "ORDER123",
        year: 2026,
        membershipType: "full",
        purpose: "renew",
      },
      deps: {
        db: {} as unknown as AdminFirestore.Firestore,
        now,
        paypal: {
          env: "SANDBOX",
          clientId: "id",
          clientSecret: "secret",
          fetchImpl,
        },
      },
    });

    expect(requestedUrls).toEqual([
      "POST https://api-m.sandbox.paypal.com/v1/oauth2/token",
      "GET https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123",
      "POST https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123/capture",
    ]);

    expect(recordPayPalMembershipPaymentMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      now,
      payment: {
        uid: "uid1",
        year: 2026,
        membershipType: "full",
        purpose: "renew",
        amount: 100,
        currency: "USD",
        paypalStatus: "COMPLETED",
        orderId: "ORDER123",
      },
    });

    expect(resp).toEqual({
      ok: true,
      reused: false,
      paypalStatus: "COMPLETED",
      amount: 100,
      currency: "USD",
    });
  });
});

describe("verifyAndRecordDonationPayment", () => {
  beforeEach(() => {
    recordPayPalDonationPaymentMock.mockReset();
  });

  it("captures APPROVED orders and uses the captured COMPLETED status", async () => {
    const requestedUrls: string[] = [];

    recordPayPalDonationPaymentMock.mockResolvedValue({ reused: false });

    const fetchImpl: typeof fetch = async (url, init) => {
      const requestUrl = String(url);
      requestedUrls.push(`${init?.method ?? "GET"} ${requestUrl}`);

      if (requestUrl.includes("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (
        requestUrl.includes("/v2/checkout/orders/ORDER123/capture") &&
        init?.method === "POST"
      ) {
        return new Response(
          JSON.stringify({
            id: "ORDER123",
            status: "COMPLETED",
            purchase_units: [
              { amount: { currency_code: "USD", value: "25.00" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (
        requestUrl.includes("/v2/checkout/orders/ORDER123") &&
        init?.method === "GET"
      ) {
        return new Response(
          JSON.stringify({
            id: "ORDER123",
            status: "APPROVED",
            purchase_units: [
              { amount: { currency_code: "USD", value: "25.00" } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return new Response("not found", { status: 404 });
    };

    const now = new Date("2026-03-08T00:00:00.000Z");

    const resp = await verifyAndRecordDonationPayment({
      uid: "uid1",
      request: {
        orderId: "ORDER123",
        year: 2026,
      },
      deps: {
        db: {} as unknown as AdminFirestore.Firestore,
        now,
        paypal: {
          env: "SANDBOX",
          clientId: "id",
          clientSecret: "secret",
          fetchImpl,
        },
      },
    });

    expect(requestedUrls).toEqual([
      "POST https://api-m.sandbox.paypal.com/v1/oauth2/token",
      "GET https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123",
      "POST https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER123/capture",
    ]);

    expect(recordPayPalDonationPaymentMock).toHaveBeenCalledWith({
      db: expect.any(Object),
      now,
      payment: {
        uid: "uid1",
        year: 2026,
        amount: 25,
        currency: "USD",
        paypalStatus: "COMPLETED",
        orderId: "ORDER123",
      },
    });

    expect(resp).toEqual({
      ok: true,
      reused: false,
      paypalStatus: "COMPLETED",
      amount: 25,
      currency: "USD",
    });
  });
});
