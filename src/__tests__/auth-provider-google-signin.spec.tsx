import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  class MockGoogleAuthProvider {
    addScope = vi.fn();
    setCustomParameters = vi.fn();
  }

  return {
    onAuthStateChanged: vi.fn(),
    getRedirectResult: vi.fn(async () => null),
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    sendSignInLinkToEmail: vi.fn(),
    isSignInWithEmailLink: vi.fn(),
    signInWithEmailLink: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
  };
});

vi.mock("@/config/firebase", () => ({
  auth: { currentUser: null },
  withAuthPersistenceRetry: async <T,>(operation: () => Promise<T>) =>
    operation(),
  getAnalyticsInstance: () => undefined,
}));

vi.mock("@/hooks/useFCMToken", () => ({
  FCM_TOKEN_ID_KEY: "rgc_fcm_token_id",
  useFCMToken: () => ({
    shouldPrompt: false,
    requestPermission: vi.fn(),
    dismissPrompt: vi.fn(),
  }),
}));

vi.mock("@/api/users", () => ({
  getUserProfile: vi.fn(async () => null),
}));

vi.mock("firebase/analytics", () => ({
  setUserProperties: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
  getRedirectResult: authMocks.getRedirectResult,
  signInWithEmailAndPassword: authMocks.signInWithEmailAndPassword,
  createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
  sendEmailVerification: authMocks.sendEmailVerification,
  GoogleAuthProvider: authMocks.GoogleAuthProvider,
  signInWithPopup: authMocks.signInWithPopup,
  signInWithRedirect: authMocks.signInWithRedirect,
  signOut: authMocks.signOut,
  sendSignInLinkToEmail: authMocks.sendSignInLinkToEmail,
  isSignInWithEmailLink: authMocks.isSignInWithEmailLink,
  signInWithEmailLink: authMocks.signInWithEmailLink,
  sendPasswordResetEmail: authMocks.sendPasswordResetEmail,
}));

describe("AuthProvider signInWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return () => {};
    });
    authMocks.signInWithPopup.mockResolvedValue({
      user: { uid: "popup-user" },
    });
    authMocks.signInWithRedirect.mockResolvedValue(undefined);

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: false,
    });
  });

  it("uses redirect when running in standalone display mode", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const { AuthProvider, useAuth } = await import("@/providers/AuthProvider");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(authMocks.signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(authMocks.signInWithPopup).not.toHaveBeenCalled();
  });

  it("uses popup when not in standalone mode", async () => {
    const { AuthProvider, useAuth } = await import("@/providers/AuthProvider");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(authMocks.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("uses popup when navigator is unavailable", async () => {
    const { AuthProvider, useAuth } = await import("@/providers/AuthProvider");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const navigatorDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "navigator",
    );

    Object.defineProperty(window, "navigator", {
      configurable: true,
      value: undefined,
    });

    try {
      await act(async () => {
        await result.current.signInWithGoogle();
      });
    } finally {
      if (navigatorDescriptor) {
        Object.defineProperty(window, "navigator", navigatorDescriptor);
      }
    }

    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
    expect(authMocks.signInWithRedirect).not.toHaveBeenCalled();
  });
});
