import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Polyfill CSS.escape used by @react-aria
if (!(globalThis as any).CSS) {
  (globalThis as any).CSS = {};
}
if (!(globalThis as any).CSS.escape) {
  (globalThis as any).CSS.escape = (s: string) => s;
}

// Mock hooks and APIs
const addToastMock = vi.fn();
vi.mock("@/providers/toast", () => ({ addToast: (a: any) => addToastMock(a) }));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "leader", displayName: "Leader User" } }),
}));

// Users: leader + two full members (one already on another team)
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "leader", displayName: "Leader User", membershipType: "full" },
      { id: "p2", displayName: "Player Two", membershipType: "full" },
      { id: "p3", displayName: "Player Three", membershipType: "full" },
    ],
  }),
}));

// Mock tournaments API
const upsertRegistrationMock = vi.fn(
  async (_tournamentId?: string, _regId?: string | null, _payload?: any) => {}
);
const fetchAllRegistrationsMock = vi.fn(async (_?: any) => [
  {
    id: "regExisting",
    team: [
      { id: "p2", displayName: "Player Two" },
      { id: "x", displayName: "X Person" },
    ],
    ownerId: "someone",
  },
]);
import { TournamentStatus } from "@/types/tournament";

vi.mock("@/api/tournaments", () => ({
  fetchTournament: vi.fn(async () => ({
    firestoreId: "t1",
    title: "Dup Test",
    date: new Date(),
    description: "d",
    players: 4,
    status: TournamentStatus.Open,
    prizePool: 0,
    winners: [],
    tee: "Mixed",
  })),
  fetchUserRegistration: vi.fn(async () => null),
  fetchAllRegistrations: () => fetchAllRegistrationsMock(),
  upsertRegistration: (
    tournamentId: string,
    regId: string | null,
    payload: any
  ) => upsertRegistrationMock(tournamentId, regId, payload),
  deleteRegistration: vi.fn(async () => {}),
}));

// Firestore minimal mocks to satisfy imports
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

vi.mock("@/config/firebase", () => ({ db: {} }));

import TournamentRegister from "@/pages/tournament-register";
import "@/api/tournaments";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t1/register"]}>
      <Routes>
        <Route
          path="/tournaments/:firestoreId/register"
          element={<TournamentRegister />}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("TournamentRegister duplicate teammate detection", () => {
  it("shows conflict modal with display names and proceeds only after confirmation", async () => {
    renderPage();

    // wait for heading
    expect(await screen.findByText(/Register for\s+Dup Test/i)).toBeTruthy();

    // Ensure registrations have loaded (conflict source)
    await waitFor(() => {
      expect(fetchAllRegistrationsMock).toHaveBeenCalled();
    });

    // Select Player Two (conflicting user) as teammate
    const teammate2Input = await screen.findByRole("combobox", {
      name: /teammate 2/i,
    });
    fireEvent.change(teammate2Input, { target: { value: "Player Two" } });
    fireEvent.keyDown(teammate2Input, { key: "ArrowDown" });
    const p2Option = await screen.findByRole("option", { name: "Player Two" });
    fireEvent.click(p2Option);

    // Allow state update/microtask flush so selected teammate is in component state
    await new Promise((res) => setTimeout(res, 0));

    // submit form
    const submitBtn = screen.getByRole("button", { name: /register/i });
    fireEvent.click(submitBtn);

    // conflict modal should appear with Player Two name using card UI
    const modal = await screen.findByTestId("conflict-modal");
    expect(modal).toBeTruthy();
    expect(modal.textContent).toMatch(/Player Already Registered/i);
    expect(modal.textContent).toMatch(/Player Two/);
    // Team card(s) present
    const teamCards = await screen.findAllByTestId("conflict-team-card");
    expect(teamCards.length).toBeGreaterThan(0);
    // Names list should not expose raw id 'p2'
    expect(modal.textContent).not.toMatch(/\bp2\b/);
    // Ensure the rendered team names string includes Player Two
    const namesEls = screen.getAllByTestId("conflict-team-names");
    expect(namesEls.some((el) => /Player Two/.test(el.textContent || ""))).toBe(
      true
    );
    // Should not have attempted upsert yet
    expect(upsertRegistrationMock).not.toHaveBeenCalled();

    // Continue anyway
    const contBtn = screen.getByRole("button", { name: /Continue Anyway/i });
    fireEvent.click(contBtn);

    await waitFor(() => {
      expect(upsertRegistrationMock).toHaveBeenCalled();
    });
  }, 20000);
});
