import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserProfile } from "@/hooks/useUserProfile";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u123", displayName: "Legacy Name" } }),
}));

// Mock API layer
const saveUserProfileMock = vi.fn();
const getUserProfileMock = vi.fn();
vi.mock("@/api/users", () => ({
  saveUserProfile: (...args: any[]) => saveUserProfileMock(...args),
  getUserProfile: (...args: any[]) => getUserProfileMock(...args),
}));

vi.mock("@/api/storage", () => ({
  uploadProfilePicture: vi.fn(async () => "http://mock/url.png"),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useUserProfile name derivation", () => {
  it("computes displayName from first + last on save", async () => {
    getUserProfileMock.mockResolvedValueOnce(null); // no existing profile
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    await act(async () => {
      await result.current.save({
        data: {
          firstName: "Alice",
          lastName: "Wonder",
          email: "a@example.com",
        },
      } as any);
    });
    // Ensure save was called with computed displayName
    const savedArgs = saveUserProfileMock.mock.calls[0][1];
    expect(savedArgs.displayName).toBe("Alice Wonder");
  });

  it("falls back to provided displayName if first/last missing", async () => {
    getUserProfileMock.mockResolvedValueOnce(null);
    saveUserProfileMock.mockClear();
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    await act(async () => {
      await result.current.save({
        data: { displayName: "Solo Name", email: "s@example.com" },
      } as any);
    });
    const savedArgs = saveUserProfileMock.mock.calls[0][1];
    expect(savedArgs.displayName).toBe("Solo Name");
  });
});
