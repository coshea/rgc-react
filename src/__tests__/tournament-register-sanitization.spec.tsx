import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// --- Mocks (must be declared before importing component) ---
// Polyfill CSS.escape used by @react-aria in Select internals (jsdom lacks it)
if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {};
}
if (!(globalThis as any).CSS.escape) {
  (globalThis as any).CSS.escape = (s: string) => s;
}
vi.mock("@/hooks/useUsers", () => {
  let usersState = [
    { id: "u1", displayName: "Alpha", membershipType: "full" },
    { id: "u2", displayName: "Bravo", membershipType: "full" },
  ];
  return {
    useUsers: () => ({ users: usersState }),
    // test helper export
    __setMockUsers: (u: any[]) => {
      usersState = u;
    },
  };
});

vi.mock("@/api/tournaments", () => ({
  fetchTournament: vi.fn(async () => ({
    firestoreId: "t1",
    title: "Test Tournament",
    date: new Date(),
    description: "desc",
    players: 4,
    completed: false,
    canceled: false,
    registrationOpen: true,
    prizePool: 0,
    winners: [],
    tee: "Mixed",
  })),
  fetchUserRegistration: vi.fn(async () => null),
  upsertRegistration: vi.fn(async () => {}),
  deleteRegistration: vi.fn(async () => {}),
}));

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", membershipType: "full" } }),
}));

// Import after mocks so they take effect
import TournamentRegister from "@/pages/tournament-register";
// Access mock helper (not in real module types)
import * as UsersHookModule from "@/hooks/useUsers";
const { __setMockUsers } = UsersHookModule as any;

describe("TournamentRegister teammate selection sanitization", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("removes stale user ids without emitting Select key warnings", async () => {
    render(
      <MemoryRouter initialEntries={["/tournaments/t1/register"]}>
        <Routes>
          <Route
            path="/tournaments/:firestoreId/register"
            element={<TournamentRegister />}
          />
        </Routes>
      </MemoryRouter>
    );

    // Wait for initial load
    const heading = await screen.findByText(/Register for\s+Test Tournament/i);
    expect(heading).toBeTruthy();

    // Open the select (Team Leader / You)
    const trigger = screen.getByRole("button", { name: /team leader/i });
    fireEvent.click(trigger);
    // There can be multiple 'Bravo' nodes (hidden select + visible item); choose the visible listbox option
    const bravoMatches = await screen.findAllByText("Bravo");
    const bravo =
      bravoMatches.find((el) => el.getAttribute("role") !== "option") ||
      bravoMatches[0];
    fireEvent.click(bravo);

    // Remove Bravo from users list, leaving only Alpha
    await act(async () => {
      __setMockUsers([
        { id: "u1", displayName: "Alpha", membershipType: "full" },
      ]);
    });

    // Ensure no HeroUI missing key warnings were produced
    const warns = warnSpy.mock.calls.map((c) => c.join(" "));
    const hasSelectMissing = warns.some((w) => /Select: Keys/.test(w));
    expect(hasSelectMissing).toBe(false);
  });
});
