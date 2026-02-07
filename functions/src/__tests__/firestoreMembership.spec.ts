import { describe, expect, it } from "vitest";

import {
  recordCheckMembershipPayment,
  recordPayPalDonationPayment,
  recordPayPalMembershipPayment,
} from "../firestoreMembership";
import { MEMBERSHIP_TYPES } from "../types";

function createFakeDb() {
  const store = new Map<string, any>();
  const configStore = new Map<string, any>();

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          const path = `${name}/${id}`;
          return {
            id,
            path,
            async get() {
              if (name === "config") {
                const configDoc = configStore.get(path);
                return {
                  exists: Boolean(configDoc),
                  data: () => configDoc,
                };
              }
              return {
                exists: store.has(path),
                data: () => store.get(path),
              };
            },
          };
        },
      };
    },
    async runTransaction<T>(fn: (tx: any) => Promise<T>) {
      const tx = {
        async get(ref: { path: string }) {
          return {
            exists: store.has(ref.path),
            data: () => store.get(ref.path),
          };
        },
        set(ref: { path: string }, data: any) {
          store.set(ref.path, data);
        },
      };
      return fn(tx);
    },
    __store: store,
    __config: configStore,
  };

  return db;
}

const now = {
  now: true,
} as unknown as import("firebase-admin").firestore.FieldValue;

describe("firestoreMembership", () => {
  it("records PayPal dues and donation as separate memberPayments", async () => {
    const db = createFakeDb();
    db.__config.set("config/membershipSettings", {
      fullMembershipPrice: 85,
      handicapMembershipPrice: 50,
    });
    db.__store.set("users/user1", { displayName: "User One" });

    const resp = await recordPayPalMembershipPayment({
      db: db as unknown as import("firebase-admin").firestore.Firestore,
      now,
      payment: {
        uid: "user1",
        year: 2026,
        membershipType: MEMBERSHIP_TYPES.FULL,
        purpose: "renew",
        amount: 100,
        currency: "USD",
        paypalStatus: "COMPLETED",
        orderId: "ORDER1",
      },
    });

    expect(resp.reused).toBe(false);

    const dues = db.__store.get("memberPayments/ORDER1_dues");
    const donation = db.__store.get("memberPayments/ORDER1_donation");
    const paypalOrder = db.__store.get("paypalOrders/ORDER1");

    expect(dues).toMatchObject({
      userId: "user1",
      displayName: "User One",
      year: 2026,
      amount: 85,
      method: "paypal",
      membershipType: "full",
      status: "confirmed",
      purpose: "dues",
      groupId: "ORDER1",
    });
    expect(donation).toMatchObject({
      userId: "user1",
      displayName: "User One",
      year: 2026,
      amount: 15,
      method: "paypal",
      membershipType: "full",
      status: "confirmed",
      purpose: "donation",
      groupId: "ORDER1",
    });
    expect(paypalOrder).toMatchObject({
      uid: "user1",
      year: 2026,
      membershipType: "full",
      amount: 100,
      membershipFee: 85,
      donationAmount: 15,
      currency: "USD",
    });
  });

  it("records pending check payments with optional donation", async () => {
    const db = createFakeDb();
    db.__config.set("config/membershipSettings", {
      fullMembershipPrice: 85,
      handicapMembershipPrice: 50,
    });

    const resp = await recordCheckMembershipPayment({
      db: db as unknown as import("firebase-admin").firestore.Firestore,
      now,
      payment: {
        uid: "user2",
        year: 2026,
        membershipType: MEMBERSHIP_TYPES.HANDICAP,
        donationAmount: 10,
        requestId: "req123",
      },
    });

    expect(resp.reused).toBe(false);
    expect(resp.groupId).toBe("check_user2_2026_req123");

    const dues = db.__store.get("memberPayments/check_user2_2026_req123_dues");
    const donation = db.__store.get(
      "memberPayments/check_user2_2026_req123_donation",
    );

    expect(dues).toMatchObject({
      userId: "user2",
      year: 2026,
      amount: 50,
      method: "check",
      membershipType: "handicap",
      status: "pending",
      purpose: "dues",
      groupId: "check_user2_2026_req123",
    });
    expect(donation).toMatchObject({
      userId: "user2",
      year: 2026,
      amount: 10,
      method: "check",
      membershipType: "handicap",
      status: "pending",
      purpose: "donation",
      groupId: "check_user2_2026_req123",
    });
  });

  it("records PayPal donation as a standalone memberPayments entry", async () => {
    const db = createFakeDb();
    db.__store.set("users/user3", { displayName: "User Three" });

    const resp = await recordPayPalDonationPayment({
      db: db as unknown as import("firebase-admin").firestore.Firestore,
      now,
      payment: {
        uid: "user3",
        year: 2026,
        amount: 25,
        currency: "USD",
        paypalStatus: "COMPLETED",
        orderId: "ORDER_DONATE",
      },
    });

    expect(resp.reused).toBe(false);

    const donation = db.__store.get("memberPayments/ORDER_DONATE_donation");
    const paypalOrder = db.__store.get("paypalOrders/ORDER_DONATE");

    expect(donation).toMatchObject({
      userId: "user3",
      displayName: "User Three",
      year: 2026,
      amount: 25,
      method: "paypal",
      status: "confirmed",
      purpose: "donation",
      groupId: "ORDER_DONATE",
    });
    expect(paypalOrder).toMatchObject({
      uid: "user3",
      year: 2026,
      purpose: "donation",
      amount: 25,
      donationAmount: 25,
      currency: "USD",
    });
  });
});
