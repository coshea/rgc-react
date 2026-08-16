import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentRegister from "@/pages/tournament-register";
import "@testing-library/jest-dom";
import { TournamentStatus } from "@/types/tournament";
import { openRegistrationWindow } from "./tournament-utils";
import type { RegistrationPayload } from "@/api/tournaments";

type FetchUserRegistrationReturn =
  | (RegistrationPayload & { id: string })
  | null;

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

const {
  fetchTournamentMock,
  upsertRegistrationMock,
  fetchAllRegistrationsMock,
} = vi.hoisted(() => ({
  upsertRegistrationMock: vi.fn(async () => "reg1"),
  fetchAllRegistrationsMock: vi.fn(
    async () => [] as FetchUserRegistrationReturn[],
  ),
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
  fetchAllRegistrations: fetchAllRegistrationsMock,
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

vi.mock("@/config/firebase", () => ({
  db: {},
  getAnalyticsInstance: () => null,
}));

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

describe("TournamentRegister open-spots / partner-team checkbox visibility", () => {
  it("hides 'Open to new players' card when min team size is not yet met (4-player tournament, leader only)", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Four Player Tourney",
      date: new Date(),
      description: "d",
      players: 4,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });

    renderPage();
    await screen.findByText(/Register for\s+Four Player Tourney/i);

    expect(screen.queryByText(/Open to new players/i)).not.toBeInTheDocument();
  });

  it("shows 'Open to new players' card when min team size is met and open slots remain (4-player, 2 pre-filled)", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Four Player Tourney",
      date: new Date(),
      description: "d",
      players: 4,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });
    // Pre-fill with 2 players so min is met and 2 slots remain open
    fetchAllRegistrationsMock.mockResolvedValueOnce([
      {
        id: "reg1",
        team: [
          { id: "u1", displayName: "Alpha" },
          { id: "u2", displayName: "Beta" },
        ],
        ownerId: "u1",
      },
    ]);

    renderPage();
    await screen.findByText(/Register for\s+Four Player Tourney/i);

    await screen.findByText(/Open to new players/i);
    expect(screen.getByText(/Open to new players/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Looking for a partner team/i),
    ).not.toBeInTheDocument();
  });

  it("lets the user toggle open-spots option and saves it on submit", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Four Player Tourney",
      date: new Date(),
      description: "d",
      players: 4,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });
    fetchAllRegistrationsMock.mockResolvedValueOnce([
      {
        id: "reg1",
        team: [
          { id: "u1", displayName: "Alpha" },
          { id: "u2", displayName: "Beta" },
        ],
        ownerId: "u1",
        openSpotsOptIn: false,
      },
    ]);

    renderPage();
    await screen.findByText(/Register for\s+Four Player Tourney/i);

    const openToNewPlayersText =
      await screen.findByText(/Open to new players/i);
    fireEvent.click(openToNewPlayersText);

    const submitBtn = screen.getByRole("button", {
      name: /Update registration/i,
    });
    await act(async () => {
      submitBtn.click();
    });

    expect(upsertRegistrationMock).toHaveBeenCalledWith(
      "t1",
      "reg1",
      expect.objectContaining({ openSpotsOptIn: true }),
    );
  });

  it("hides 'Looking for a partner team' card when 2-player tournament min is not met (leader only)", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Two Player Tourney",
      date: new Date(),
      description: "d",
      players: 2,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });

    renderPage();
    await screen.findByText(/Register for\s+Two Player Tourney/i);

    expect(
      screen.queryByText(/Looking for a partner team/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Open to new players/i)).not.toBeInTheDocument();
  });

  it("shows 'Looking for a partner team' card when 2-player tournament is fully filled", async () => {
    fetchTournamentMock.mockResolvedValueOnce({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Two Player Tourney",
      date: new Date(),
      description: "d",
      players: 2,
      status: TournamentStatus.Upcoming,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
    });
    // Pre-fill both slots so the team is full and partner-team card should show
    fetchAllRegistrationsMock.mockResolvedValueOnce([
      {
        id: "reg2",
        team: [
          { id: "u1", displayName: "Alpha" },
          { id: "u2", displayName: "Beta" },
        ],
        ownerId: "u1",
        openSpotsOptIn: false,
      },
    ]);

    renderPage();
    await screen.findByText(/Register for\s+Two Player Tourney/i);

    await screen.findByText(/Looking for a partner team/i);
    expect(screen.getByText(/Looking for a partner team/i)).toBeInTheDocument();
    expect(screen.queryByText(/Open to new players/i)).not.toBeInTheDocument();
  });
});
