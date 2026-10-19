import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "server-timestamp"),
    increment: vi.fn((n: number) => ({ increment: n })),
    arrayUnion: vi.fn((...v: unknown[]) => ({ arrayUnion: v })),
  },
}));

import {
  recordEmailIssues,
  recordSeasonWrappedClick,
  toEmailIssue,
  verifyResendSignature,
} from "../resendWebhook";

// Svix's published example (docs.svix.com, "How to verify manually").
const SVIX = {
  secret: "whsec_plJ3nmyCDGBKInavdOK15jsl",
  id: "msg_loFOjxBNrRLzqYUf",
  timestamp: "1731705121",
  body: '{"event_type":"ping","data":{"success":true}}',
  signature: "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
};
const SVIX_NOW = Number(SVIX.timestamp);

describe("verifyResendSignature", () => {
  it("accepts Svix's published example signature", () => {
    expect(
      verifyResendSignature(
        SVIX.secret,
        { id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature },
        SVIX.body,
        SVIX_NOW,
      ),
    ).toBe(true);
  });

  it("accepts when any of several signatures matches", () => {
    expect(
      verifyResendSignature(
        SVIX.secret,
        {
          id: SVIX.id,
          timestamp: SVIX.timestamp,
          signature: `v1,AAAA ${SVIX.signature}`,
        },
        SVIX.body,
        SVIX_NOW,
      ),
    ).toBe(true);
  });

  it("rejects a modified body", () => {
    expect(
      verifyResendSignature(
        SVIX.secret,
        { id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature },
        SVIX.body.replace("true", "false"),
        SVIX_NOW,
      ),
    ).toBe(false);
  });

  it("rejects stale timestamps (replays)", () => {
    expect(
      verifyResendSignature(
        SVIX.secret,
        { id: SVIX.id, timestamp: SVIX.timestamp, signature: SVIX.signature },
        SVIX.body,
        SVIX_NOW + 10 * 60,
      ),
    ).toBe(false);
  });

  it("rejects missing headers and the wrong secret", () => {
    expect(verifyResendSignature(SVIX.secret, {}, SVIX.body, SVIX_NOW)).toBe(
      false,
    );
    const otherSecret = `whsec_${Buffer.from("other").toString("base64")}`;
    const forged = createHmac("sha256", Buffer.from("other"))
      .update(`${SVIX.id}.${SVIX.timestamp}.${SVIX.body}`)
      .digest("base64");
    expect(
      verifyResendSignature(
        SVIX.secret,
        { id: SVIX.id, timestamp: SVIX.timestamp, signature: `v1,${forged}` },
        SVIX.body,
        SVIX_NOW,
      ),
    ).toBe(false);
    expect(
      verifyResendSignature(
        otherSecret,
        { id: SVIX.id, timestamp: SVIX.timestamp, signature: `v1,${forged}` },
        SVIX.body,
        SVIX_NOW,
      ),
    ).toBe(true);
  });
});

describe("toEmailIssue", () => {
  it("records permanent bounces only", () => {
    expect(
      toEmailIssue({
        type: "email.bounced",
        data: { bounce: { type: "Permanent", message: "No such user" } },
      }),
    ).toEqual({ status: "bounced", reason: "No such user" });
    expect(
      toEmailIssue({
        type: "email.bounced",
        data: { bounce: { type: "Transient", message: "Mailbox full" } },
      }),
    ).toBeNull();
  });

  it("records complaints and suppressions, ignores other events", () => {
    expect(toEmailIssue({ type: "email.complained" })?.status).toBe(
      "complained",
    );
    expect(
      toEmailIssue({
        type: "email.suppressed",
        data: { suppressed: { message: "On suppression list" } },
      }),
    ).toEqual({ status: "suppressed", reason: "On suppression list" });
    expect(toEmailIssue({ type: "email.delivered" })).toBeNull();
  });
});

describe("recordEmailIssues", () => {
  it("writes one doc per recipient keyed by lowercased email", async () => {
    const set = vi.fn();
    const commit = vi.fn();
    const doc = vi.fn((id: string) => ({ id }));
    const db = {
      batch: () => ({ set, commit }),
      collection: vi.fn(() => ({ doc })),
    } as unknown as Parameters<typeof recordEmailIssues>[0];

    const count = await recordEmailIssues(db, {
      type: "email.bounced",
      created_at: "2026-10-18T12:00:00.000Z",
      data: {
        email_id: "em_1",
        to: ["Pat@Example.com"],
        tags: { category: "registration_opening" },
        bounce: { type: "Permanent", message: "No such user" },
      },
    });

    expect(count).toBe(1);
    expect(doc).toHaveBeenCalledWith("pat@example.com");
    expect(set).toHaveBeenCalledWith(
      { id: "pat@example.com" },
      {
        email: "Pat@Example.com",
        status: "bounced",
        reason: "No such user",
        emailId: "em_1",
        category: "registration_opening",
        occurredAt: "2026-10-18T12:00:00.000Z",
        updatedAt: "server-timestamp",
      },
    );
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("does nothing for ignored events", async () => {
    const db = {
      batch: vi.fn(),
    } as unknown as Parameters<typeof recordEmailIssues>[0];
    await expect(
      recordEmailIssues(db, { type: "email.delivered", data: { to: ["a@x"] } }),
    ).resolves.toBe(0);
  });
});

describe("recordSeasonWrappedClick", () => {
  function fakeDb(existing: Record<string, unknown> | undefined) {
    const set = vi.fn();
    const doc = vi.fn(() => ({ path: "delivery-doc" }));
    const db = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({ collection: vi.fn(() => ({ doc })) })),
      })),
      runTransaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) =>
        fn({ get: vi.fn(async () => ({ data: () => existing })), set }),
      ),
    };
    return { db, set, doc };
  }

  const click = {
    type: "email.clicked",
    created_at: "2026-12-02T15:00:00.000Z",
    data: {
      tags: { category: "season_wrapped", year: "2026", uid: "uid_1" },
      click: { link: "https://ridgefieldgolfclub.org/wrapped/2026?utm_source=resend" },
    },
  };

  it("records the first click on a Wrapped email", async () => {
    const { db, set, doc } = fakeDb(undefined);
    await expect(
      recordSeasonWrappedClick(db as unknown as Parameters<typeof recordSeasonWrappedClick>[0], click),
    ).resolves.toBe(true);
    expect(doc).toHaveBeenCalledWith("uid_1");
    expect(set).toHaveBeenCalledWith(
      { path: "delivery-doc" },
      {
        uid: "uid_1",
        emailClicks: { increment: 1 },
        lastEmailClickAt: click.created_at,
        firstEmailClickAt: click.created_at,
      },
      { merge: true },
    );
  });

  it("keeps the first click time on later clicks", async () => {
    const { db, set } = fakeDb({ firstEmailClickAt: "2026-12-01T00:00:00.000Z" });
    await recordSeasonWrappedClick(db as unknown as Parameters<typeof recordSeasonWrappedClick>[0], click);
    expect(set.mock.calls[0][1]).not.toHaveProperty("firstEmailClickAt");
  });

  it("doesn't count clicks on other links in the email", async () => {
    const { db } = fakeDb(undefined);
    await expect(
      recordSeasonWrappedClick(db as unknown as Parameters<typeof recordSeasonWrappedClick>[0], {
        ...click,
        data: { ...click.data, click: { link: "https://ridgefieldgolfclub.org/profile#notifications" } },
      }),
    ).resolves.toBe(true);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });

  it("counts a retried webhook delivery once", async () => {
    const { db, set } = fakeDb({ emailClicks: 1, emailClickEventIds: ["msg_1"] });
    await recordSeasonWrappedClick(db as unknown as Parameters<typeof recordSeasonWrappedClick>[0], click, "msg_1");
    expect(set).not.toHaveBeenCalled();
  });

  it("ignores clicks on other emails and other event types", async () => {
    const { db } = fakeDb(undefined);
    const typedDb = db as unknown as Parameters<typeof recordSeasonWrappedClick>[0];
    await expect(
      recordSeasonWrappedClick(typedDb, { ...click, data: { tags: { category: "registration_opening" } } }),
    ).resolves.toBe(false);
    await expect(recordSeasonWrappedClick(typedDb, { ...click, type: "email.bounced" })).resolves.toBe(false);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
});
