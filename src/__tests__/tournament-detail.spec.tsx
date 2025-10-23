import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDetailPage from "@/pages/tournament-detail";
import { TournamentStatus } from "@/types/tournament";

// Mock hooks & Auth
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user1" } }),
}));
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ userProfile: {} }),
}));
// Control admin flag via membership hook (avoid Firestore admin doc mocks)
let isAdminMock = false;
vi.mock("@/components/membership/hooks", () => ({
  useDocAdminFlag: () => ({ isAdmin: isAdminMock, loadingAdmin: false }),
}));

// API-level listeners simulation
const apiListeners: Record<string, Array<(value: unknown) => void>> = {};
function emitDoc(path: string, data: any) {
  act(() => {
    (apiListeners[path] || []).forEach((cb) =>
      cb({
        exists: () => !!data,
        id: path.split("/").pop(),
        data: () => data,
      })
    );
  });
}
function emitCollection(
  path: string,
  docs: Array<{ id: string; data: () => any }>
) {
  act(() => {
    (apiListeners[path] || []).forEach((cb) => cb({ docs }));
  });
}

vi.mock("@/api/tournaments", () => ({
  onTournament: (id: string, next: any) => {
    const key = `tournaments/${id}`;
    apiListeners[key] = apiListeners[key] || [];
    apiListeners[key].push(next);
    return () => {
      apiListeners[key] = (apiListeners[key] || []).filter((fn) => fn !== next);
    };
  },
  onTournamentRegistrations: (id: string, next: any) => {
    const key = `tournaments/${id}/registrations`;
    apiListeners[key] = apiListeners[key] || [];
    apiListeners[key].push(next);
    return () => {
      apiListeners[key] = (apiListeners[key] || []).filter((fn) => fn !== next);
    };
  },
  mapTournamentDoc: (snap: any) => ({ firestoreId: snap.id, ...snap.data() }),
  deleteTournament: vi.fn(async () => {}),
}));

vi.mock("@/api/users", () => ({ getUsers: async () => [] }));

// Avoid rendering markdown heavy component cost
vi.mock("react-markdown", () => ({
  default: (p: any) => <div data-testid="md">{p.children}</div>,
}));
vi.mock("remark-gfm", () => ({}));

// Mock TournamentEditor lazy import so Suspense fallback resolves immediately
vi.mock("@/components/tournament-editor", () => ({
  TournamentEditor: () => <div data-testid="editor">Editor</div>,
}));

function renderWithRoute(id: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/t/${id}`]}>
        <Routes>
          <Route path="/t/:firestoreId" element={<TournamentDetailPage />} />
          <Route
            path="/tournaments"
            element={<div data-testid="tournaments-list">Tournaments List</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const baseTournament = {
  title: "Club Championship",
  date: new Date(),
  description: "Desc",
  players: 4,
  status: TournamentStatus.Open,
  prizePool: 500,
  winnerGroups: [
    {
      id: "overall",
      label: "Overall",
      type: "overall",
      order: 1,
      winners: [
        {
          place: 1,
          competitors: [{ userId: "u1", displayName: "Alice" }],
          prizeAmount: 100,
        },
      ],
    },
  ],
  tee: "Blue",
};

describe("TournamentDetailPage", () => {
  beforeEach(() => {
    Object.keys(apiListeners).forEach((k) => delete apiListeners[k]);
    isAdminMock = false;
  });

  it("renders loading then tournament title", async () => {
    renderWithRoute("abc");
    expect(screen.getByText(/Loading tournament/i)).toBeInTheDocument();
    emitDoc("tournaments/abc", baseTournament);
    await waitFor(() =>
      expect(screen.getByText("Club Championship")).toBeInTheDocument()
    );
  });

  it("back button always navigates to tournaments list", async () => {
    renderWithRoute("back1");
    emitDoc("tournaments/back1", baseTournament);
    await screen.findByText("Club Championship");
    const backBtn = screen.getByRole("button", {
      name: /go back to tournaments list/i,
    });
    await act(async () => {
      backBtn.click();
    });
    await screen.findByTestId("tournaments-list");
  });

  it("shows registration open chip and register button when open and user not registered", async () => {
    renderWithRoute("open1");
    emitDoc("tournaments/open1", {
      ...baseTournament,
      status: TournamentStatus.Open,
      winners: [],
    });
    await screen.findByText("Club Championship");
    expect(screen.getAllByText(/Registration Open/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Register/i })
    ).toBeInTheDocument();
  });

  it("shows registered state when user is part of a team", async () => {
    renderWithRoute("reg1");
    emitDoc("tournaments/reg1", {
      ...baseTournament,
      status: TournamentStatus.Open,
    });
    emitCollection("tournaments/reg1/registrations", []);
    emitCollection("tournaments/reg1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "user1",
          team: [{ id: "user1", displayName: "You" }],
        }),
      },
    ]);
    await waitFor(() =>
      expect(screen.getByText(/You're registered/i)).toBeInTheDocument()
    );
  });

  it("shows closed message when registration closed", async () => {
    renderWithRoute("closed1");
    emitDoc("tournaments/closed1", {
      ...baseTournament,
      status: TournamentStatus.Upcoming,
    });
    await screen.findByText("Club Championship");
    expect(
      screen.getByText(/Registration is currently closed/i)
    ).toBeInTheDocument();
  });

  it("shows all winners with placements", async () => {
    renderWithRoute("win1");
    emitDoc("tournaments/win1", {
      ...baseTournament,
      winnerGroups: [
        {
          id: "overall",
          label: "Overall",
          type: "overall",
          order: 1,
          winners: [
            {
              place: 1,
              competitors: [{ userId: "c1", displayName: "Champ" }],
              prizeAmount: 50,
            },
            {
              place: 2,
              competitors: [{ userId: "r1", displayName: "Runner" }],
              prizeAmount: 25,
            },
          ],
        },
      ],
    });
    await screen.findByText("Club Championship");
    expect(screen.getByText(/1st: Champ/)).toBeInTheDocument();
    expect(screen.getByText(/2nd: Runner/)).toBeInTheDocument();
  });

  it("shows admin action buttons when user is admin", async () => {
    renderWithRoute("admin1");
    // Set admin flag via hook mock
    isAdminMock = true;
    emitDoc("tournaments/admin1", baseTournament);
    await screen.findByText("Club Championship");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Edit tournament/i })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: /Delete tournament/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Export registrations/i })
    ).toBeInTheDocument();
  });

  it("highlights teams with open spots", async () => {
    renderWithRoute("spots1");
    emitDoc("tournaments/spots1", { ...baseTournament, players: 4 });
    emitCollection("tournaments/spots1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "other",
          team: [
            { id: "u10", displayName: "Player A" },
            { id: "u11", displayName: "Player B" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");
    expect(screen.getByText(/2 Spots Open/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/2 open team spots?/i)).toBeInTheDocument();
  });

  it("filters to show only teams needing players when toggle active", async () => {
    renderWithRoute("filter1");
    emitDoc("tournaments/filter1", { ...baseTournament, players: 4 });
    emitCollection("tournaments/filter1/registrations", [
      {
        id: "full1",
        data: () => ({
          ownerId: "o1",
          team: [
            { id: "a", displayName: "A" },
            { id: "b", displayName: "B" },
            { id: "c", displayName: "C" },
            { id: "d", displayName: "D" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
      {
        id: "open1",
        data: () => ({
          ownerId: "o2",
          team: [
            { id: "e", displayName: "E" },
            { id: "f", displayName: "F" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");
    expect(screen.getByText(/Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();
    const toggleBtn = screen.getByRole("button", {
      name: /Toggle show teams needing players/i,
    });
    await act(async () => {
      toggleBtn.click();
    });
    await waitFor(() => expect(screen.queryByText(/Team 1/i)).toBeNull());
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Spots Open/i)).toBeInTheDocument();
    await act(async () => {
      toggleBtn.click();
    });
    await screen.findByText(/Team 1/i);
  });
});
