import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  renderHook,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import React from "react";

// Mock Firebase Auth first
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
}));

// Mock Firebase config
vi.mock("@/config/firebase", () => ({
  auth: {},
  db: {},
  getAnalyticsInstance: () => null,
}));

// Mock API functions
vi.mock("@/api/users", () => ({
  getUsers: vi.fn(),
}));

vi.mock("@/api/championships", () => ({
  fetchChampionshipsWithPagination: vi.fn(),
}));

// Mock admin hook
vi.mock("@/components/membership/hooks", () => ({
  useDocAdminFlag: () => ({ isAdmin: false, loadingAdmin: false }),
}));

// Mock championships hook
vi.mock("@/hooks/useChampionships", () => ({
  useInfiniteChampionships: () => ({
    championships: [],
    isLoading: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
}));

// Mock intersection observer
vi.mock("@/hooks/useIntersectionObserver", () => ({
  useIntersectionObserver: () => ({
    targetRef: { current: null },
    isIntersecting: false,
  }),
}));

// Mock AuthProvider to avoid real onAuthStateChanged side-effects in test environment.
// Tests will control the global __TEST_AUTH_USER value to simulate auth state.
vi.mock("@/providers/AuthProvider", () => {
  return {
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useAuth: () => {
      const user = globalThis.__TEST_AUTH_USER ?? null;
      return {
        user,
        userLoggedIn: !!user,
        loading: false,
        error: null,
        loginEmailAndPassword: async () => {},
        signupEmailAndPassword: async () => {},
        signInWithGoogle: async () => {},
        logout: async () => {},
      };
    },
  };
});

import { AuthProvider } from "@/providers/AuthProvider";
import type { UnifiedChampionship } from "@/types/championship";

const mockChampionship: UnifiedChampionship = {
  id: "champ-1",
  year: 2024,
  championshipType: "club-champion",
  winnerNames: ["John Champion", "Jane Winner"],
  winnerIds: ["user-1", "user-2"],
  runnerUpNames: ["Bob Runner"],
  runnerUpIds: ["user-3"],
  isHistorical: false,
};

const mockUsers = [
  { id: "user-1", displayName: "John Champion", email: "john@example.com" },
  { id: "user-2", displayName: "Jane Winner", email: "jane@example.com" },
  { id: "user-3", displayName: "Bob Runner", email: "bob@example.com" },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  TestWrapper.displayName = "TestWrapper";
  return TestWrapper;
}

describe("Championship Public Access Integration", () => {
  let mockGetUsers: any;

  // Ensure a clean environment between tests to avoid mock/module pollution
  beforeEach(async () => {
    // Clear and reset mocks so previous test state doesn't leak
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Import mocks after resetting modules
    const usersApi = await import("@/api/users");
    mockGetUsers = vi.mocked(usersApi.getUsers);
    mockGetUsers.mockResolvedValue(mockUsers);
    // Reset test auth global
    globalThis.__TEST_AUTH_USER = null;
    // Clear DOM between runs
    document.body.innerHTML = "";
  });

  afterEach(() => {
    // Unmount any mounted components and clear DOM
    cleanup();
    vi.clearAllMocks();
  });

  it("can render championship card for unauthenticated users", async () => {
    // Ensure unauthenticated
    globalThis.__TEST_AUTH_USER = null;

    const { ChampionshipCard } = await import(
      "@/components/championship-display"
    );
    const wrapper = createWrapper();

    render(<ChampionshipCard championship={mockChampionship} />, { wrapper });

    // Await the visible texts
    await screen.findByText("John Champion", {}, { timeout: 10000 });
    expect(screen.getByText("Jane Winner")).toBeInTheDocument();
    expect(screen.getByText("Bob Runner")).toBeInTheDocument();
    // Should not have profile links for unauthenticated users
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  }, 15000);

  it("shows profile links for authenticated and verified users", async () => {
    // Mock authenticated and verified user
    const mockUser = {
      uid: "test-user",
      email: "test@example.com",
      emailVerified: true,
    };
    globalThis.__TEST_AUTH_USER = mockUser;

    const { ChampionshipCard } = await import(
      "@/components/championship-display"
    );
    const wrapper = createWrapper();

    render(<ChampionshipCard championship={mockChampionship} />, { wrapper });

    // Await the visible text and then check for profile buttons
    await screen.findByText("John Champion", {}, { timeout: 10000 });
    // Should have profile links for authenticated and verified users
    // HeroUI links render as buttons, so check for buttons with href attributes
    const profileButtons = await screen.findAllByRole(
      "button",
      {},
      { timeout: 10000 },
    );
    const profileLinks = profileButtons.filter((button) =>
      button.getAttribute("href")?.includes("/profile/"),
    );
    expect(profileLinks.length).toBeGreaterThan(0);
  }, 15000);

  it("renders past champions page for unauthenticated users", async () => {
    // Ensure unauthenticated
    globalThis.__TEST_AUTH_USER = null;

    const PastChampionsModule = await import("@/pages/past-champions");
    const PastChampions = PastChampionsModule.default;
    const wrapper = createWrapper();

    render(<PastChampions />, { wrapper });

    // Should render the page title
    expect(screen.getByText("Past Champions")).toBeInTheDocument();

    // Should not show error messages related to permissions
    expect(
      screen.queryByText(/Missing or insufficient permissions/),
    ).not.toBeInTheDocument();
  });

  it("can test useUsers hook with public access", async () => {
    // Ensure unauthenticated
    globalThis.__TEST_AUTH_USER = null;

    const { useUsers } = await import("@/hooks/useUsers");
    const wrapper = createWrapper();

    const { result } = renderHook(() => useUsers({ publicNamesOnly: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.users.length).toBeGreaterThan(0);
    });

    expect(result.current.users).toEqual(mockUsers);
  });

  it("can test useUsersMap hook returns Map object", async () => {
    // Ensure unauthenticated
    globalThis.__TEST_AUTH_USER = null;

    const { useUsersMap } = await import("@/hooks/useUsers");
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => useUsersMap({ publicNamesOnly: true }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.usersMap.size).toBeGreaterThan(0);
    });

    expect(result.current.usersMap.get("user-1")).toEqual(mockUsers[0]);
    expect(result.current.usersMap.get("user-2")).toEqual(mockUsers[1]);
    expect(result.current.usersMap.get("user-3")).toEqual(mockUsers[2]);
  });

  it("handles API errors gracefully", async () => {
    // Mock API error
    mockGetUsers.mockRejectedValue(new Error("API Error"));

    // Ensure unauthenticated
    globalThis.__TEST_AUTH_USER = null;

    const { useUsers } = await import("@/hooks/useUsers");
    const wrapper = createWrapper();

    const { result } = renderHook(() => useUsers({ publicNamesOnly: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });
});
