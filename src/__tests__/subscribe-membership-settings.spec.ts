import { describe, it, expect, vi, afterEach } from "vitest";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";

describe("subscribeMembershipSettings onError handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // reset module registry so dynamic imports pick up fresh mocks
    vi.resetModules();
  });

  it("falls back to defaults for permission-denied and does not call onError", async () => {
    // Mock firebase/firestore before importing the module under test.
    vi.doMock("firebase/firestore", () => ({
      getFirestore: () => ({}),
      doc: () => ({}),
      onSnapshot: (_ref: any, _next: any, error: any) => {
        error?.({ code: "permission-denied" });
        return () => {};
      },
    }));

    const { subscribeMembershipSettings } = await import("@/api/membership");

    const cb = vi.fn();
    const onError = vi.fn();

    const unsub = subscribeMembershipSettings(cb, onError);

    expect(cb).toHaveBeenCalledWith(DEFAULT_MEMBERSHIP_SETTINGS);
    expect(onError).not.toHaveBeenCalled();
    expect(typeof unsub).toBe("function");
  });

  it("calls onError for other errors and does not call callback", async () => {
    const err = { code: "unavailable", message: "network error" };

    vi.doMock("firebase/firestore", () => ({
      getFirestore: () => ({}),
      doc: () => ({}),
      onSnapshot: (_ref: any, _next: any, error: any) => {
        error?.(err);
        return () => {};
      },
    }));

    const { subscribeMembershipSettings } = await import("@/api/membership");

    const cb = vi.fn();
    const onError = vi.fn();

    const unsub = subscribeMembershipSettings(cb, onError);

    expect(onError).toHaveBeenCalledWith(err);
    expect(cb).not.toHaveBeenCalled();
    expect(typeof unsub).toBe("function");
  });
});
