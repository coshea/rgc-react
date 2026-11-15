import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  setUserProperties: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/config/firebase", () => ({
  auth: { currentUser: null },
  withAuthPersistenceRetry: async <T,>(operation: () => Promise<T>) =>
    operation(),
  getAnalyticsInstance: () => ({}),
}));

vi.mock("@/hooks/usePushSubscription", () => ({
  PUSH_SUBSCRIPTION_ID_KEY: "rgc_push_subscription_id",
  LEGACY_FCM_TOKEN_ID_KEY: "rgc_fcm_token_id",
  usePushSubscription: () => ({
    shouldPrompt: false,
    needsResubscribe: false,
    requestPermission: vi.fn(),
    dismissPrompt: vi.fn(),
  }),
}));

vi.mock("@/api/users", () => ({ getUserProfile: mocks.getUserProfile }));

vi.mock("firebase/analytics", () => ({
  setUserProperties: mocks.setUserProperties,
}));

vi.mock("@sentry/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/react")>()),
  captureException: mocks.captureException,
  setUser: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (u: unknown) => void) => {
    callback({ uid: "member-1" });
    return () => {};
  },
  getRedirectResult: vi.fn(async () => null),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

const permissionDenied = Object.assign(
  new Error("Missing or insufficient permissions."),
  { code: "permission-denied" },
);

async function renderProvider() {
  const { AuthProvider } = await import("@/providers/AuthProvider");
  render(
    <AuthProvider>
      <div />
    </AuthProvider>,
  );
}

describe("AnalyticsUserTagger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a denied profile read instead of rejecting", async () => {
    mocks.getUserProfile
      .mockRejectedValueOnce(permissionDenied)
      .mockResolvedValue({ membershipType: "full" });

    await renderProvider();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mocks.getUserProfile).toHaveBeenCalledTimes(2);
    expect(mocks.setUserProperties).toHaveBeenCalledWith(expect.anything(), {
      membership_tier: "full",
    });
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("stops after repeated denials without reporting", async () => {
    mocks.getUserProfile.mockRejectedValue(permissionDenied);

    await renderProvider();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(mocks.getUserProfile).toHaveBeenCalledTimes(5);
    expect(mocks.setUserProperties).not.toHaveBeenCalled();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it("reports other errors once and stops", async () => {
    mocks.getUserProfile.mockRejectedValue(new Error("boom"));

    await renderProvider();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mocks.getUserProfile).toHaveBeenCalledTimes(1);
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
});
