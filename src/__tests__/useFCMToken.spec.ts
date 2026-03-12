import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const DISMISSED_KEY = "rgc_notif_prompt_dismissed";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// shouldPrompt / dismissPrompt tests (state-only — no Firebase I/O)
// ---------------------------------------------------------------------------

describe("useFCMToken — shouldPrompt", () => {
  beforeEach(() => {
    // Simulate a real messaging object so the hook doesn't bail out early
    vi.doMock("@/config/firebase", () => ({
      db: {},
      messaging: {
        /* truthy */
      },
    }));
    vi.doMock("firebase/messaging", () => ({
      getToken: vi.fn().mockResolvedValue("tok-abc"),
    }));
    vi.doMock("firebase/firestore", () => ({
      doc: vi.fn(() => ({})),
      setDoc: vi.fn().mockResolvedValue(undefined),
      serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    }));
    // Mock the env var so VAPID_KEY is treated as set
    vi.stubEnv("VITE_FCM_VAPID_KEY", "test-vapid-key");
  });

  it("is true when permission is 'default' and prompt not dismissed", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "default" },
      writable: true,
      configurable: true,
    });

    const { renderHook } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken("user-123"));

    expect(result.current.shouldPrompt).toBe(true);
  });

  it("is false when permission is 'denied'", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "denied" },
      writable: true,
      configurable: true,
    });

    const { renderHook } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken("user-123"));

    expect(result.current.shouldPrompt).toBe(false);
  });

  it("is false when prompt was previously dismissed", async () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    Object.defineProperty(window, "Notification", {
      value: { permission: "default" },
      writable: true,
      configurable: true,
    });

    const { renderHook } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken("user-123"));

    expect(result.current.shouldPrompt).toBe(false);
  });

  it("is false when uid is null", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "default" },
      writable: true,
      configurable: true,
    });

    const { renderHook } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken(null));

    expect(result.current.shouldPrompt).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dismissPrompt
// ---------------------------------------------------------------------------

describe("useFCMToken — dismissPrompt", () => {
  it("sets localStorage dismissed key and turns shouldPrompt false", async () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "default" },
      writable: true,
      configurable: true,
    });

    vi.doMock("@/config/firebase", () => ({ db: {}, messaging: {} }));
    vi.doMock("firebase/messaging", () => ({ getToken: vi.fn() }));
    vi.doMock("firebase/firestore", () => ({
      doc: vi.fn(),
      setDoc: vi.fn(),
      serverTimestamp: vi.fn(),
    }));
    vi.stubEnv("VITE_FCM_VAPID_KEY", "test-vapid-key");

    const { renderHook, act } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken("user-123"));
    expect(result.current.shouldPrompt).toBe(true);

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.shouldPrompt).toBe(false);
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// requestPermission
// ---------------------------------------------------------------------------

describe("useFCMToken — requestPermission", () => {
  it("calls Notification.requestPermission and registers token when granted", async () => {
    const setDoc = vi.fn().mockResolvedValue(undefined);
    const getToken = vi.fn().mockResolvedValue("device-token-xyz");

    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
      writable: true,
      configurable: true,
    });

    vi.doMock("@/config/firebase", () => ({ db: {}, messaging: {} }));
    vi.doMock("firebase/messaging", () => ({ getToken }));
    vi.doMock("firebase/firestore", () => ({
      doc: vi.fn(() => ({})),
      setDoc,
      serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    }));
    vi.stubEnv("VITE_FCM_VAPID_KEY", "test-vapid-key");

    const { renderHook, act } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken("user-123"));

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(getToken).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalled();
  });

  it("does not register token when permission is denied", async () => {
    const setDoc = vi.fn();
    const getToken = vi.fn();

    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("denied"),
      },
      writable: true,
      configurable: true,
    });

    vi.doMock("@/config/firebase", () => ({ db: {}, messaging: {} }));
    vi.doMock("firebase/messaging", () => ({ getToken }));
    vi.doMock("firebase/firestore", () => ({
      doc: vi.fn(),
      setDoc,
      serverTimestamp: vi.fn(),
    }));
    vi.stubEnv("VITE_FCM_VAPID_KEY", "test-vapid-key");

    const { renderHook, act } = await import("@testing-library/react");
    const { useFCMToken } = await import("@/hooks/useFCMToken");

    const { result } = renderHook(() => useFCMToken("user-123"));

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(getToken).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });
});
