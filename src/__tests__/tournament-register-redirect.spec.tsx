import { describe, it, expect, vi } from "vitest";
import * as FS from "firebase/firestore";
import { render, screen, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TournamentRegister from "@/pages/tournament-register";
import "@testing-library/jest-dom";

// Mocks
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "u1", displayName: "Alpha" },
      { id: "u2", displayName: "Beta" },
    ],
  }),
}));

vi.mock("firebase/firestore", () => {
  return {
    getDoc: vi.fn(),
    addDoc: vi.fn(),
    setDoc: vi.fn(),
    getDocs: vi.fn(),
    where: vi.fn(),
    query: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ _ts: true })),
  };
});

vi.mock("@/config/firebase", () => ({ db: {} }));

// Toasts noop
vi.mock("@heroui/react", async () => {
  const mod: any = await vi.importActual("@heroui/react");
  return { ...mod, addToast: () => {} };
});

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

    // Mock implementation details
    const tournamentData = {
      title: "Fall Classic",
      date: new Date(),
      description: "Desc",
      players: 2,
      completed: false,
      canceled: false,
      registrationOpen: true,
      winners: [],
      prizePool: 0,
    };

    // getDoc returns a tournament snapshot
    (FS.getDoc as any).mockResolvedValueOnce({
      exists: () => true,
      id: "abc123",
      data: () => tournamentData,
    });
    // No pre-existing registration (stable for any calls)
    (FS.getDocs as any).mockResolvedValue({ empty: true, docs: [] });

    (FS.addDoc as any).mockResolvedValueOnce({ id: "newReg" });

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/tournaments/abc123/register"]}>
          <TestWrapper />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for tournament title to render
    await screen.findByText(/Register for Fall Classic/i);

    // Select first teammate (Team Leader / You select)
    // The select is a controlled HeroUI Select; simplest is to simulate updating the state by selecting option text.
    // Because component uses onSelectionChange with selectedKeys, we can dispatch a change via fireEvent if needed.
    // Simpler: directly invoke form submission after ensuring the teammate list is populated with placeholder.

    // Emulate choosing a teammate by mocking internal state: easiest path -> fill the only select using DOM queries.
    // We can simplify: since validation requires at least one teammate, we'll mock out the teammates state logic by
    // pre-populating selection through firing the change event.

    const selectTrigger = screen.getByRole("button", { name: /Team Leader/i });
    // Open list
    await act(async () => {
      selectTrigger.click();
    });
    // Find listbox and click Alpha option (avoid hidden native select duplicate)
    const listbox = await screen.findByRole("listbox");
    const alphaOption = within(listbox).getByText("Alpha");
    await act(async () => {
      alphaOption.click();
    });

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
