import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentRegister from "@/pages/tournament-register";
import "@testing-library/jest-dom";
import { openRegistrationWindow } from "./tournament-utils";

const upsertRegistrationMock = vi.fn(
  async (_tournamentId: string, _regId: string | null, _payload: unknown) => {},
);

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", displayName: "Alpha" } }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      {
        id: "u1",
        displayName: "Alpha",
        membershipType: "full",
        defaultGoldTee: true,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/providers/toast", () => ({ addToast: () => {} }));

vi.mock("@/api/tournaments", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/api/tournaments")>();
  return {
    ...original,
    fetchTournament: vi.fn(async () => ({
      ...openRegistrationWindow(),
      firestoreId: "t1",
      title: "Gold Tee Default Test",
      date: new Date(),
      description: "Desc",
      players: 1,
      prizePool: 0,
      winners: [],
      tee: "Mixed",
      goldTeesEnabled: true,
    })),
    fetchUserRegistration: vi.fn(async () => null),
    fetchAllRegistrations: vi.fn(async () => []),
    upsertRegistration: (
      tournamentId: string,
      regId: string | null,
      payload: unknown,
    ) => upsertRegistrationMock(tournamentId, regId, payload),
  };
});

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
    _delegate: {
      app: { options: {} },
      settings: {},
    },
  },
  getAnalyticsInstance: () => null,
}));

describe("TournamentRegister gold tee defaults", () => {
  beforeEach(() => {
    upsertRegistrationMock.mockClear();
  });

  it("submits the leader with goldTee=true when defaultGoldTee is enabled", async () => {
    render(
      <MemoryRouter initialEntries={["/tournaments/t1/register"]}>
        <Routes>
          <Route
            path="/tournaments/:firestoreId/register"
            element={<TournamentRegister />}
          />
          <Route path="/tournaments/:firestoreId" element={<div>Detail</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/Register for\s+Gold Tee Default Test/i);

    fireEvent.click(screen.getByRole("button", { name: /^register$/i }));

    await waitFor(() => {
      expect(upsertRegistrationMock).toHaveBeenCalled();
    });

    const firstCall = upsertRegistrationMock.mock.calls[0];
    expect(firstCall).toBeTruthy();

    const payload = firstCall?.[2] as unknown as {
      team?: Array<{ id: string; displayName?: string; goldTee?: boolean }>;
    };

    expect(payload?.team).toBeTruthy();
    expect(payload.team?.[0]?.id).toBe("u1");
    expect(payload.team?.[0]?.displayName).toBe("Alpha");
    expect(payload.team?.[0]?.goldTee).toBe(true);
  });
});
