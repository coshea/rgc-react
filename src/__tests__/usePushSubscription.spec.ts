import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Sentry is imported by usePushSubscription — mock it so calls are no-ops
vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  startSpan: (_opts: unknown, callback: () => unknown) => callback(),
}));

const DISMISSED_KEY = "rgc_notif_prompt_dismissed";

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const CURRENT_KEY_BYTES = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
const LEGACY_KEY_BYTES = new Uint8Array(65).map((_, i) =>
  i === 0 ? 4 : 255 - i,
);
const VAPID_KEY = toBase64Url(CURRENT_KEY_BYTES);

const SUBSCRIPTION_JSON = {
  endpoint: "https://web.push.apple.com/device-abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

function makeSubscription(keyBytes: Uint8Array, json = SUBSCRIPTION_JSON) {
  return {
    options: { applicationServerKey: keyBytes.slice().buffer },
    toJSON: () => json,
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

interface SetupOptions {
  permission: NotificationPermission;
  requestPermissionResult?: NotificationPermission;
  existingSubscription?: ReturnType<typeof makeSubscription> | null;
  pageSubscribe?: () => Promise<unknown>;
  workerReply?: { ok: boolean; subscription?: unknown; error?: string };
}

function setup({
  permission,
  requestPermissionResult = "granted",
  existingSubscription = null,
  pageSubscribe = () =>
    Promise.resolve(makeSubscription(CURRENT_KEY_BYTES)),
  workerReply,
}: SetupOptions) {
  const setDoc = vi.fn().mockResolvedValue(undefined);
  const deleteDoc = vi.fn().mockResolvedValue(undefined);
  const subscribe = vi.fn(pageSubscribe);
  const workerPostMessage = vi.fn(
    (_message: unknown, transfer: MessagePort[]) => {
      if (workerReply) transfer[0].postMessage(workerReply);
    },
  );

  const registration = {
    active: { postMessage: workerPostMessage },
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(existingSubscription),
      subscribe,
    },
  };

  Object.defineProperty(window, "Notification", {
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue(requestPermissionResult),
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "PushManager", {
    value: function PushManager() {},
    writable: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      register: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });

  vi.doMock("@/config/firebase", () => ({ db: {} }));
  vi.doMock("firebase/firestore", () => ({
    doc: vi.fn((_db: unknown, ...segments: string[]) => ({
      path: segments.join("/"),
    })),
    setDoc,
    deleteDoc,
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  }));
  vi.stubEnv("VITE_WEB_PUSH_VAPID_PUBLIC_KEY", VAPID_KEY);

  return { setDoc, deleteDoc, subscribe, workerPostMessage, registration };
}

async function loadHook() {
  const testingLibrary = await import("@testing-library/react");
  const hookModule = await import("@/hooks/usePushSubscription");
  return { ...testingLibrary, ...hookModule };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  localStorage.clear();
});

describe("usePushSubscription — shouldPrompt", () => {
  it("is true when permission is 'default' and prompt not dismissed", async () => {
    setup({ permission: "default" });
    const { renderHook, waitFor, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    await waitFor(() => expect(result.current.shouldPrompt).toBe(true));
  });

  it("is false when permission is 'denied'", async () => {
    setup({ permission: "denied" });
    const { renderHook, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    expect(result.current.shouldPrompt).toBe(false);
  });

  it("is false when prompt was previously dismissed", async () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setup({ permission: "default" });
    const { renderHook, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    expect(result.current.shouldPrompt).toBe(false);
  });

  it("is false when uid is null", async () => {
    setup({ permission: "default" });
    const { renderHook, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription(null));

    expect(result.current.shouldPrompt).toBe(false);
  });

  it("is false when the VAPID key is not configured", async () => {
    setup({ permission: "default" });
    vi.stubEnv("VITE_WEB_PUSH_VAPID_PUBLIC_KEY", "");
    const { renderHook, usePushSubscription, isPushSupported } =
      await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    expect(isPushSupported()).toBe(false);
    expect(result.current.shouldPrompt).toBe(false);
  });
});

describe("usePushSubscription — dismissPrompt", () => {
  it("sets localStorage dismissed key and turns shouldPrompt false", async () => {
    setup({ permission: "default" });
    const { renderHook, act, waitFor, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));
    await waitFor(() => expect(result.current.shouldPrompt).toBe(true));

    act(() => {
      result.current.dismissPrompt();
    });

    expect(result.current.shouldPrompt).toBe(false);
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
  });
});

describe("usePushSubscription — requestPermission", () => {
  it("subscribes in the page and stores the subscription when granted", async () => {
    const { setDoc, subscribe } = setup({ permission: "default" });
    const { renderHook, act, usePushSubscription, subscriptionDocId } =
      await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    const docId = subscriptionDocId(SUBSCRIPTION_JSON.endpoint);
    expect(setDoc).toHaveBeenCalledWith(
      { path: `users/user-123/pushSubscriptions/${docId}` },
      expect.objectContaining({
        endpoint: SUBSCRIPTION_JSON.endpoint,
        keys: SUBSCRIPTION_JSON.keys,
        createdAt: "SERVER_TIMESTAMP",
      }),
      { merge: true },
    );
    expect(result.current.isPushEnabledOnDevice).toBe(true);
    expect(localStorage.getItem("rgc_push_subscription_id")).toBe(docId);
  });

  it("does not subscribe when permission is denied", async () => {
    const { setDoc, subscribe } = setup({
      permission: "default",
      requestPermissionResult: "denied",
    });
    const { renderHook, act, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(window.Notification.requestPermission).toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe("usePushSubscription — launch sync", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("reuses an existing subscription with the current key", async () => {
    const { setDoc, subscribe, workerPostMessage } = setup({
      permission: "granted",
      existingSubscription: makeSubscription(CURRENT_KEY_BYTES),
    });
    const { renderHook, waitFor, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(subscribe).not.toHaveBeenCalled();
    expect(workerPostMessage).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(result.current.isPushEnabledOnDevice).toBe(true),
    );
  });

  it("migrates a legacy FCM install via the service worker and removes the old token", async () => {
    localStorage.setItem("rgc_fcm_token_id", "legacy-token-doc");
    const { setDoc, deleteDoc, subscribe, workerPostMessage } = setup({
      permission: "granted",
      existingSubscription: makeSubscription(LEGACY_KEY_BYTES),
      workerReply: { ok: true, subscription: SUBSCRIPTION_JSON },
    });
    const { renderHook, waitFor, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(workerPostMessage).toHaveBeenCalledWith(
      { type: "PUSH_SUBSCRIBE", applicationServerKey: VAPID_KEY },
      expect.any(Array),
    );
    // Worker succeeded, so the page never needed to subscribe itself.
    expect(subscribe).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(deleteDoc).toHaveBeenCalledWith({
        path: "users/user-123/fcmTokens/legacy-token-doc",
      }),
    );
    expect(localStorage.getItem("rgc_fcm_token_id")).toBeNull();
    expect(result.current.needsResubscribe).toBe(false);
  });

  it("asks for a tap when neither the worker nor the page can subscribe", async () => {
    const { setDoc } = setup({
      permission: "granted",
      existingSubscription: makeSubscription(LEGACY_KEY_BYTES),
      workerReply: { ok: false, error: "NotAllowedError" },
      pageSubscribe: () =>
        Promise.reject(new Error("Subscribing requires a user gesture")),
    });
    const { renderHook, waitFor, usePushSubscription } = await loadHook();

    const { result } = renderHook(() => usePushSubscription("user-123"));

    await waitFor(() => expect(result.current.needsResubscribe).toBe(true));
    expect(result.current.isPushEnabledOnDevice).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("re-saves the subscription when the app regains focus after a long idle period", async () => {
    const { setDoc } = setup({
      permission: "granted",
      existingSubscription: makeSubscription(CURRENT_KEY_BYTES),
    });
    const { renderHook, waitFor, usePushSubscription } = await loadHook();

    renderHook(() => usePushSubscription("user-123"));
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));

    // A focus inside the refresh window does not write again.
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(setDoc).toHaveBeenCalledTimes(1);

    localStorage.setItem(
      "rgc_push_subscription_refreshed_at",
      String(Date.now() - 13 * 60 * 60 * 1000),
    );
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(2));
    // Later refreshes do not overwrite createdAt.
    expect(setDoc.mock.calls[1][1]).not.toHaveProperty("createdAt");
  });
});

describe("subscriptionDocId", () => {
  it("is stable and distinguishes endpoints that share a prefix", async () => {
    const { subscriptionDocId } = await loadHook();
    const a = subscriptionDocId("https://web.push.apple.com/aaaa");
    const b = subscriptionDocId("https://web.push.apple.com/aaab");

    expect(a).toBe(subscriptionDocId("https://web.push.apple.com/aaaa"));
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});
