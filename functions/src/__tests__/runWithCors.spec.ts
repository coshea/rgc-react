import { describe, expect, it } from "vitest";

import { runWithCors } from "../httpUtils";

type CorsReq = Parameters<typeof runWithCors>[0];
type CorsRes = Parameters<typeof runWithCors>[1];

function fakeReqRes(): { req: CorsReq; res: CorsRes } {
  const req = { method: "POST", headers: { origin: "https://example.org" } };
  const res = {
    statusCode: 200,
    setHeader: () => undefined,
    getHeader: () => undefined,
    end: () => undefined,
  };
  return { req: req as CorsReq, res: res as unknown as CorsRes };
}

describe("runWithCors", () => {
  it("resolves only after the async handler finishes", async () => {
    const { req, res } = fakeReqRes();
    let finished = false;
    await runWithCors(req, res, async () => {
      await new Promise((r) => setTimeout(r, 10));
      finished = true;
    });
    expect(finished).toBe(true);
  });

  it("rejects when the handler throws", async () => {
    const { req, res } = fakeReqRes();
    await expect(
      runWithCors(req, res, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
