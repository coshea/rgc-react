import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

let currentUsers: Array<{
  id: string;
  displayName: string;
  membershipType: string;
}> = [];
let currentUsersLoading = true;
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({ users: currentUsers, isLoading: currentUsersLoading }),
}));

const {
  fetchTournamentMock,
  fetchAllRegistrationsMock,
  upsertRegistrationMock,
} = vi.hoisted(() => ({
  fetchTournamentMock: vi.fn(async (_id: string) => ({
    ...openRegistrationWindow(),
    firestoreId: "t1",
    title: "Restoration Test",
    date: new Date(),
    description: "d",
    players: 2,
    status: TournamentStatus.Upcoming,
    prizePool: 0,
    winners: [],
    tee: "Mixed",
  })),
  fetchAllRegistrationsMock: vi.fn(async () => [
    {
      id: "reg-non-owner",
      ownerId: "u9",
      memberIds: ["u1", "u9"],
      team: [
        { id: "u1", displayName: "Alpha" },
        { id: "u9", displayName: "Other Captain" },
      ],
      openSpotsOptIn: false,
    },
    {
      id: "reg-existing",
      ownerId: "u1",
      memberIds: ["u1", "u2"],
      team: [
        { id: "u1", displayName: "Alpha" },
        { id: "u2", displayName: "Beta" },
      ],
      openSpotsOptIn: false,
    },
  ]),
  upsertRegistrationMock: vi.fn(async () => "reg-existing"),
}));

const ownedRegistrationOnly = [
  {
    id: "reg-existing",
    ownerId: "u1",
    memberIds: ["u1", "u2"],
    team: [
      { id: "u1", displayName: "Alpha" },
      { id: "u2", displayName: "Beta" },
    ],
    openSpotsOptIn: false,
  },
];

vi.mock("@/api/tournaments", () => ({
  fetchTournament: fetchTournamentMock,
  fetchUserRegistration: vi.fn(async () => null),
  fetchAllRegistrations: fetchAllRegistrationsMock,
  upsertRegistration: upsertRegistrationMock,
  deleteRegistration: vi.fn(async () => {}),
}));

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

describe("TournamentRegister existing registration restore", () => {
  beforeEach(() => {
    currentUsers = [];
    currentUsersLoading = true;
    fetchTournamentMock.mockClear();
    fetchAllRegistrationsMock.mockClear();
    upsertRegistrationMock.mockClear();
    addToastMock.mockClear();
  });

  it("shows restored teammates even before the full users list loads", async () => {
    const { rerender } = renderPage();

    expect(
      await screen.findByText(/Register for\s+Restoration Test/i),
    ).toBeTruthy();
    await waitFor(() => expect(fetchAllRegistrationsMock).toHaveBeenCalled());

    // Simulate registration restore resolving before the teammate appears in useUsers.
    currentUsers = [{ id: "u1", displayName: "Alpha", membershipType: "full" }];
    currentUsersLoading = false;
    rerender(
      <MemoryRouter initialEntries={["/tournaments/t1/register"]}>
        <Routes>
          <Route
            path="/tournaments/:firestoreId/register"
            element={<TournamentRegister />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        /You're already registered — update your team below\./i,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Update registration/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      const selected = screen.getAllByRole("combobox");
      expect(
        selected.some((el) => /Beta/.test((el as HTMLInputElement).value)),
      ).toBe(true);
    });
  });

  it("updates the existing registration using the restored team id", async () => {
    fetchAllRegistrationsMock.mockResolvedValueOnce(ownedRegistrationOnly);

    const { rerender } = renderPage();

    expect(
      await screen.findByText(/Register for\s+Restoration Test/i),
    ).toBeTruthy();
    await waitFor(() => expect(fetchAllRegistrationsMock).toHaveBeenCalled());

    currentUsers = [{ id: "u1", displayName: "Alpha", membershipType: "full" }];
    currentUsersLoading = false;
    rerender(
      <MemoryRouter initialEntries={["/tournaments/t1/register"]}>
        <Routes>
          <Route
            path="/tournaments/:firestoreId/register"
            element={<TournamentRegister />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /Update registration/i });
    fireEvent.click(
      screen.getByRole("button", { name: /Update registration/i }),
    );

    await waitFor(() => {
      expect(upsertRegistrationMock).toHaveBeenCalledWith(
        "t1",
        "reg-existing",
        expect.objectContaining({
          ownerId: "u1",
          team: expect.arrayContaining([
            expect.objectContaining({ id: "u1", displayName: "Alpha" }),
            expect.objectContaining({ id: "u2", displayName: "Beta" }),
          ]),
        }),
      );
    });
  });
});
