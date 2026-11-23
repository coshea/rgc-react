import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildChunkIdempotencyKey,
  postToResend,
  RESEND_BATCH_URL,
  RESEND_EMAILS_URL,
  ResendApiError,
  type ResendBatchEmail,
  sendResendBatch,
} from "../resendBatch";
import { sendTournamentLeaderEmail } from "../sendRegistrationEmails";

function email(to: string): ResendBatchEmail {
  return { from: "from@example.com", to: [to], subject: "Hi", html: "<p/>" };
}

function response(status: number, retryAfter?: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(retryAfter ? { "retry-after": retryAfter } : {}),
    text: async () => JSON.stringify({ name: "rate_limit_exceeded" }),
  } as unknown as Response;
}

const noSleep = vi.fn(async () => undefined);

afterEach(() => {
  vi.unstubAllGlobals();
  noSleep.mockClear();
});

describe("sendResendBatch", () => {
  it("splits into chunks of 100 with one request each", async () => {
    const fetchMock = vi.fn(async () => response(200));
    vi.stubGlobal("fetch", fetchMock);

    const emails = Array.from({ length: 250 }, (_, i) => email(`m${i}@x.org`));
    const result = await sendResendBatch("key", emails, {
      idempotencyPrefix: "registration-opening/t1",
      sleep: noSleep,
    });

    expect(result).toEqual({ sent: 250, failed: 0, failedIndices: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(RESEND_BATCH_URL);
    expect(JSON.parse(String(init.body))).toHaveLength(100);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(
      /^registration-opening\/t1\/[0-9a-f]{32}$/,
    );
  });

  it("retries 429 responses using retry-after", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, "2"))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendResendBatch("key", [email("a@x.org")], {
      idempotencyPrefix: "p",
      sleep: noSleep,
    });

    expect(result.sent).toBe(1);
    expect(noSleep).toHaveBeenCalledWith(2000);
    // Same key on retry so Resend de-duplicates it.
    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> })
        .headers["Idempotency-Key"],
    );
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not retry client errors and throws when nothing was sent", async () => {
    const fetchMock = vi.fn(async () => response(403));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendResendBatch("key", [email("a@x.org")], {
        idempotencyPrefix: "p",
        sleep: noSleep,
      }),
    ).rejects.toBeInstanceOf(ResendApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a partial send instead of throwing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(422));
    vi.stubGlobal("fetch", fetchMock);

    const emails = Array.from({ length: 150 }, (_, i) => email(`m${i}@x.org`));
    await expect(
      sendResendBatch("key", emails, { idempotencyPrefix: "p", sleep: noSleep }),
    ).resolves.toEqual({
      sent: 100,
      failed: 50,
      failedIndices: Array.from({ length: 50 }, (_, i) => 100 + i),
    });
  });
});

describe("buildChunkIdempotencyKey", () => {
  it("is stable regardless of recipient order or case", () => {
    expect(
      buildChunkIdempotencyKey("p", [email("B@x.org"), email("a@x.org")]),
    ).toBe(buildChunkIdempotencyKey("p", [email("a@x.org"), email("b@x.org")]));
  });

  it("changes when the recipients change", () => {
    expect(buildChunkIdempotencyKey("p", [email("a@x.org")])).not.toBe(
      buildChunkIdempotencyKey("p", [email("c@x.org")]),
    );
  });
});

describe("postToResend", () => {
  it("retries 429 and 5xx with the same idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetchMock);

    await postToResend(RESEND_EMAILS_URL, "key", { to: ["a@x.org"] }, "k1", noSleep);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenNthCalledWith(1, 1000);
    expect(noSleep).toHaveBeenNthCalledWith(2, 2000);
    const keys = fetchMock.mock.calls.map(
      ([, init]) => (init as RequestInit & { headers: Record<string, string> })
        .headers["Idempotency-Key"],
    );
    expect(keys).toEqual(["k1", "k1", "k1"]);
  });

  it("throws a ResendApiError after the last attempt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(429)));

    await expect(
      postToResend(RESEND_EMAILS_URL, "key", {}, "k1", noSleep),
    ).rejects.toBeInstanceOf(ResendApiError);
    expect(noSleep).toHaveBeenCalledTimes(3);
  });
});

describe("registration emails", () => {
  it("send one email to /emails with an idempotency key", async () => {
    const fetchMock = vi.fn(async () => response(200));
    vi.stubGlobal("fetch", fetchMock);

    await sendTournamentLeaderEmail("key", "lead@x.org", {
      firstName: "Pat",
      tournamentTitle: "Club Championship",
      tournamentDate: "June 1, 2026",
      tournamentTee: "White",
      tournamentTeeTimes: "Assigned",
      teamMembersHtml: "",
      tournamentUrl: "https://example.org/t/1",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(JSON.parse(String(init.body)).to).toEqual(["lead@x.org"]);
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
