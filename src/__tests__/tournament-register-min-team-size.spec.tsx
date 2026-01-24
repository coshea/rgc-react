import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentRegister from "@/pages/tournament-register";
import "@testing-library/jest-dom";
import { TournamentStatus } from "@/types/tournament";
import { openRegistrationWindow } from "./tournament-utils";

const addToastMock = vi.fn();
vi.mock("@/providers/toast", () => ({ addToast: (a: any) => addToastMock(a) }));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Alpha" } }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "u1", displayName: "Alpha", membershipType: "full" },
      { id: "u2", displayName: "Beta", membershipType: "full" },
    ],
  }),
}));

const { fetchTournamentMock, upsertRegistrationMock } = vi.hoisted(() => ({
  upsertRegistrationMock: vi.fn(async () => "reg1"),
  fetchTournamentMock: vi.fn(async (_id: string) => ({
    ...openRegistrationWindow(),
    firestoreId: "t1",
    title: "Min Team Tournament",
    date: new Date(),
    description: "d",
    players: 2,
    status: TournamentStatus.Upcoming,
    prizePool: 0,
    winners: [],
    tee: "Mixed",
  })),
}));

// Mock tournaments API
vi.mock("@/api/tournaments", () => ({
  fetchTournament: fetchTournamentMock,
  fetchUserRegistration: vi.fn(async () => null),
  fetchAllRegistrations: vi.fn(async () => []),
  upsertRegistration: upsertRegistrationMock,
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/tournaments/t1/register"]}>
      <Routes>
        <Route
          path="/tournaments/:firestoreId/register"
          element={<TournamentRegister />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TournamentRegister min team size", () => {
  it("requires at least 2 players when team size > 1", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Min Team Tournament",
      date: new Date(),
      description: "d",
      players: 2,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });

    renderPage();

    await screen.findByText(/Register for\s+Min Team Tournament/i);

    // With only the auto-selected leader, register should be blocked.
    const submitBtn = screen.getByRole("button", { name: /^Register$/i });
    expect(submitBtn).toBeDisabled();
    expect(
      screen.getByText(/add at least one teammate to register/i),
    ).toBeInTheDocument();
    expect(upsertRegistrationMock).not.toHaveBeenCalled();
  });

  it("allows solo registration when team size is 1", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Solo Tournament",
      date: new Date(),
      description: "d",
      players: 1,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });

    renderPage();

    await screen.findByText(/Register for\s+Solo Tournament/i);

    const submitBtn = screen.getByRole("button", { name: /^Register$/i });
    expect(submitBtn).not.toBeDisabled();

    await act(async () => {
      submitBtn.click();
    });

    expect(upsertRegistrationMock).toHaveBeenCalled();
  });
});
