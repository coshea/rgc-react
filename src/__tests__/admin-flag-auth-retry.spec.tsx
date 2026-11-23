import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

type Listener = {
  next: (snap: { data: () => Record<string, unknown> | undefined }) => void;
  error?: (error: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
};
const listeners: Listener[] = [];

vi.mock("@/api/membershipData", () => ({
  onAdminDoc: (
    _uid: string,
    next: Listener["next"],
    error?: Listener["error"],
  ) => {
    const unsubscribe = vi.fn();
    listeners.push({ next, error, unsubscribe });
    return unsubscribe;
  },
  onUserDoc: vi.fn(),
  onUsersCollection: vi.fn(),
  onAllFCMTokens: vi.fn(),
  onAllPushSubscriptions: vi.fn(),
}));

const captureException = vi.fn();
vi.mock("@sentry/react", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

import { useAdminFlag } from "@/components/membership/hooks";

const denied = { code: "permission-denied", message: "Missing or insufficient permissions." };

afterEach(() => {
  listeners.length = 0;
  captureException.mockClear();
  vi.useRealTimers();
});

describe("useAdminFlag", () => {
  it("resubscribes when the first listen is denied after sign-in", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAdminFlag({ uid: "u1" }));
    expect(result.current.loadingAdmin).toBe(true);

    act(() => listeners[0].error?.(denied));
    expect(captureException).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(listeners).toHaveLength(2);

    act(() => listeners[1].next({ data: () => ({ isAdmin: true }) }));
    expect(result.current).toEqual({ isAdmin: true, loadingAdmin: false });
  });

  it("stops loading and reports once retries run out", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useAdminFlag({ uid: "u1" }));

    for (let i = 0; i < 4; i++) {
      act(() => listeners[i].error?.(denied));
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
    }

    expect(listeners).toHaveLength(4);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ isAdmin: false, loadingAdmin: false });
  });

  it("cancels a pending retry on unmount", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useAdminFlag({ uid: "u1" }));
    act(() => listeners[0].error?.(denied));
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(listeners).toHaveLength(1);
  });
});
