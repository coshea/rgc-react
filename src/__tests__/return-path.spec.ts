import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeReturnPath,
  rememberReturnPath,
  takeReturnPath,
} from "@/utils/returnPath";

const WRAPPED = "/wrapped/2026?utm_source=resend&utm_content=story";

describe("returnPath", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("survives a fresh page load (magic link / Google redirect)", () => {
    rememberReturnPath(WRAPPED);
    // Router state is gone after the round-trip.
    expect(takeReturnPath(undefined)).toBe(WRAPPED);
    expect(consumeReturnPath()).toBeNull();
  });

  it("prefers router state and still clears the saved path", () => {
    rememberReturnPath("/tournaments");
    expect(takeReturnPath(WRAPPED)).toBe(WRAPPED);
    expect(consumeReturnPath()).toBeNull();
  });

  it("rejects off-site paths", () => {
    rememberReturnPath("//evil.com");
    rememberReturnPath("https://evil.com");
    expect(consumeReturnPath()).toBeNull();
    expect(takeReturnPath("//evil.com")).toBeNull();
  });

  it("ignores a stale path", () => {
    vi.useFakeTimers();
    rememberReturnPath(WRAPPED);
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    expect(consumeReturnPath()).toBeNull();
  });
});
