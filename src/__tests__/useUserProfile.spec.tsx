import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/api/users", () => ({
  getUserProfile: vi.fn(async (_uid: string) => ({
    displayName: "Test User",
    email: "t@test.com",
  })),
  saveUserProfile: vi.fn(async (_uid: string, data: any) => data),
}));
vi.mock("@/api/storage", () => ({
  uploadProfilePicture: vi.fn(
    async (_uid: string, _file: File) => "https://storage.test/avatar.png"
  ),
}));

// Mock AuthProvider's useAuth to avoid needing the real provider in tests
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "uid123", displayName: "Test User" } }),
}));

import { useUserProfile } from "@/hooks/useUserProfile";

function wrapper({ children }: any) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useUserProfile", () => {
  it("fetches profile and allows saving with upload", async () => {
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    // Force an explicit refetch so the query runs reliably in the test
    await act(async () => {
      if (result.current.refetch) await result.current.refetch();
    });
    await waitFor(() => !!result.current.userProfile);
    expect(result.current.userProfile?.displayName).toBe("Test User");

    await act(async () => {
      await result.current.save({
        data: { displayName: "New" },
        file: new File(["1"], "f.png"),
      });
    });

    // After save, refetch should have been triggered; ensure no errors
    expect(result.current.saveError).toBeNull();
  });
});
