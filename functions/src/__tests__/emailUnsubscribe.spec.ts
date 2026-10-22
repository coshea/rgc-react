import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  handler: undefined as
    | undefined
    | ((req: unknown, res: unknown) => Promise<void>),
  exists: true,
  update: vi.fn(),
  doc: vi.fn(),
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: () => ({ value: () => "test-key" }),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onRequest: (
    _options: unknown,
    handler: (req: unknown, res: unknown) => Promise<void>,
  ) => {
    state.handler = handler;
    return handler;
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: vi.fn(() => "server-timestamp") },
}));

vi.mock("firebase-admin", () => {
  const db = {
    collection: () => ({
      doc: (id: string) => {
        state.doc(id);
        return {
          get: async () => ({ exists: state.exists }),
          update: state.update,
        };
      },
    }),
  };
  return { firestore: () => db };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildUnsubscribeUrl,
  verifyUnsubscribeSignature,
} from "../emailUnsubscribe";

interface FakeRes {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  status: (code: number) => FakeRes;
  send: (body: string) => FakeRes;
  set: (name: string, value: string) => FakeRes;
  type: (value: string) => FakeRes;
}

function fakeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: "",
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    set(name, value) {
      res.headers[name] = value;
      return res;
    },
    type(value) {
      res.headers["Content-Type"] = value;
      return res;
    },
  };
  return res;
}

function queryOf(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams);
}

async function call(method: string, query: Record<string, string>) {
  const res = fakeRes();
  await state.handler?.({ method, query }, res);
  return res;
}

describe("unsubscribe links", () => {
  it("signs a link the verifier accepts", () => {
    const url = buildUnsubscribeUrl("test-key", "uid-1", "tournament_updates");
    expect(url).toMatch(
      /^https:\/\/us-central1-[a-z-]+\.cloudfunctions\.net\/email_unsubscribe\?/,
    );
    const { u, t, s } = queryOf(url ?? "");
    expect(u).toBe("uid-1");
    expect(t).toBe("tournament_updates");
    expect(
      verifyUnsubscribeSignature("test-key", "uid-1", "tournament_updates", s),
    ).toBe(true);
  });

  it("rejects a signature for another member, topic or key", () => {
    const { s } = queryOf(
      buildUnsubscribeUrl("test-key", "uid-1", "tournament_updates") ?? "",
    );
    expect(
      verifyUnsubscribeSignature("test-key", "uid-2", "tournament_updates", s),
    ).toBe(false);
    expect(
      verifyUnsubscribeSignature("test-key", "uid-1", "announcements", s),
    ).toBe(false);
    expect(
      verifyUnsubscribeSignature("other-key", "uid-1", "tournament_updates", s),
    ).toBe(false);
    expect(
      verifyUnsubscribeSignature("", "uid-1", "tournament_updates", s),
    ).toBe(false);
  });

  it("returns no link when the secret isn't configured", () => {
    expect(buildUnsubscribeUrl("", "uid-1", "announcements")).toBeUndefined();
  });
});

describe("email_unsubscribe", () => {
  const valid = queryOf(
    buildUnsubscribeUrl("test-key", "uid-1", "tournament_updates") ?? "",
  );

  beforeEach(() => {
    state.exists = true;
    state.update.mockReset();
    state.doc.mockReset();
  });

  it("turns the preference off on a one-click POST", async () => {
    const res = await call("POST", valid);

    expect(res.statusCode).toBe(200);
    expect(state.doc).toHaveBeenCalledWith("uid-1");
    expect(state.update).toHaveBeenCalledWith({
      "notificationPreferences.emailTournamentUpdates": false,
      updatedAt: "server-timestamp",
    });
    expect(res.body).toContain("You&#39;re unsubscribed");
  });

  it("maps the announcements topic to the announcement email preference", async () => {
    await call(
      "POST",
      queryOf(buildUnsubscribeUrl("test-key", "uid-1", "announcements") ?? ""),
    );
    expect(state.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "notificationPreferences.emailGeneralAnnouncements": false,
      }),
    );
  });

  it("only shows a confirm form on GET, so link scanners change nothing", async () => {
    const res = await call("GET", valid);

    expect(res.statusCode).toBe(200);
    expect(state.update).not.toHaveBeenCalled();
    expect(res.body).toContain('<form method="POST"');
    expect(res.body).toContain(`s=${valid.s}`);
  });

  it("rejects a tampered link without writing", async () => {
    const res = await call("POST", { ...valid, u: "someone-else" });

    expect(res.statusCode).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
    expect(res.body).toContain("Link not recognized");
  });

  it("rejects an unknown topic", async () => {
    const res = await call("POST", { ...valid, t: "everything" });
    expect(res.statusCode).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("succeeds without writing when the member no longer exists", async () => {
    state.exists = false;
    const res = await call("POST", valid);
    expect(res.statusCode).toBe(200);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("refuses other methods", async () => {
    const res = await call("PUT", valid);
    expect(res.statusCode).toBe(405);
  });
});
