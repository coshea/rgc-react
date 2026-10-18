import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildChunkIdempotencyKey,
  RESEND_BATCH_URL,
  ResendApiError,
  type ResendBatchEmail,
  sendResendBatch,
} from "../resendBatch";

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
