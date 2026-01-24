import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TournamentRegister from "@/pages/tournament-register";
import "@testing-library/jest-dom";

// Mocks
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", membershipType: "full" } }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "u1", displayName: "Alpha", membershipType: "full" },
      { id: "u2", displayName: "Beta", membershipType: "full" },
    ],
  }),
}));

const upsertSpy = vi.fn(async (..._args: any[]) => {});
import { openRegistrationWindow } from "./tournament-utils";

vi.mock("@/api/tournaments", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/api/tournaments")>();
  return {
    ...original,
    fetchTournament: vi.fn(async () => ({
      ...openRegistrationWindow(),
      firestoreId: "abc123",
      title: "Fall Classic",
      date: new Date(),
      description: "Desc",
      players: 2,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    })),
    fetchUserRegistration: vi.fn(async () => null),
    upsertRegistration: (...args: any[]) => upsertSpy(...args),
  };
});

// Mock Firebase Firestore functions
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  addDoc: vi.fn(async () => ({ id: "mock-id" })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  orderBy: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => new Date()),
  onSnapshot: vi.fn(() => () => {}),
}));

vi.mock("@/config/firebase", () => ({
  db: {
    // Mock firestore instance that collection() will accept
    _delegate: {
      app: { options: {} },
      settings: {},
    },
  },
}));

// Toasts noop via centralized provider
vi.mock("@/providers/toast", () => ({ addToast: () => {} }));

describe("TournamentRegister redirect", () => {
  it("navigates back to tournament detail after successful registration", async () => {
    // No explicit navigate spy needed; we assert by resulting rendered route content.

    // Spy on useNavigate by providing a wrapper route context interception
    const TestWrapper = () => {
      return (
        <Routes>
          <Route
            path="/tournaments/:firestoreId/register"
            element={<TournamentRegister />}
          />
          <Route
            path="/tournaments/:firestoreId"
            element={<div>Detail Page</div>}
          />
        </Routes>
      );
    };

    // Mock implementation details handled by API vi.mock above

    // API mocks already set via vi.mock above

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/tournaments/abc123/register"]}>
          <TestWrapper />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Wait for tournament title to render
    await screen.findByText(/Register for\s+Fall Classic/i);

    // Leader is auto-selected by RegistrationEditor effect. Select a second teammate to satisfy min team size.
    const teammate2 = await screen.findByRole("combobox", {
      name: /teammate 2/i,
    });
    fireEvent.change(teammate2, { target: { value: "Beta" } });
    fireEvent.keyDown(teammate2, { key: "ArrowDown" });
    const betaOption = await screen.findByRole("option", { name: "Beta" });
    fireEvent.click(betaOption);

    // Submit the form
    const submitBtn = screen.getByRole("button", { name: /Register$/i });
    await act(async () => {
      submitBtn.click();
    });

    // After successful addDoc, detail page should appear (route navigated)
    const detail = await screen.findByText("Detail Page");
    expect(detail).toBeInTheDocument();
  });
});
