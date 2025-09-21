import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDetailPage from "@/pages/tournament-detail";

// Mock hooks & Firestore layer
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user1" } }),
}));
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ userProfile: { admin: true } }),
}));

// Dynamic Firestore doc snapshot simulation
const listeners: Record<string, Function[]> = {};

function emitDoc(path: string, data: any) {
  act(() => {
    (listeners[path] || []).forEach((cb) =>
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
    (listeners[path] || []).forEach((cb) => cb({ docs }));
  });
}

vi.mock("firebase/firestore", async () => {
  return {
    doc: (_db: any, col: string, id: string) => `${col}/${id}`,
    collection: (_db: any, col: string, id?: string, sub?: string) =>
      id && sub ? `${col}/${id}/${sub}` : `${col}`,
    query: (c: any) => c,
    orderBy: () => ({}),
    onSnapshot: (ref: any, next: any) => {
      listeners[ref] = listeners[ref] || [];
      listeners[ref].push(next);
      return () => {
        listeners[ref] = listeners[ref].filter((fn) => fn !== next);
      };
    },
  };
});

vi.mock("@/config/firebase", () => ({ db: {} }));
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
  completed: false,
  canceled: false,
  registrationOpen: true,
  prizePool: 500,
  winners: [
    { place: 1, displayNames: ["Alice"], userIds: ["u1"], prizeAmount: 100 },
  ],
  tee: "Blue",
};

describe("TournamentDetailPage", () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
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
      registrationOpen: true,
      winners: [],
    });
    await screen.findByText("Club Championship");
    // At least one occurrence of Registration Open (chip text). Use getAllByText to avoid multiple match error.
    expect(screen.getAllByText(/Registration Open/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Register/i })
    ).toBeInTheDocument();
  });

  it("shows registered state when user is part of a team", async () => {
    renderWithRoute("reg1");
    emitDoc("tournaments/reg1", { ...baseTournament, registrationOpen: true });
    // First empty registrations snapshot
    emitCollection("tournaments/reg1/registrations", []);
    // Then snapshot containing a registration referencing current user
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
      registrationOpen: false,
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
      winners: [
        { place: 1, displayNames: ["Champ"], userIds: ["c1"], prizeAmount: 50 },
        {
          place: 2,
          displayNames: ["Runner"],
          userIds: ["r1"],
          prizeAmount: 25,
        },
      ],
    });
    await screen.findByText("Club Championship");
    // Both Champ and Runner should appear now with ordinal labels
    expect(screen.getByText(/1st: Champ/)).toBeInTheDocument();
    expect(screen.getByText(/2nd: Runner/)).toBeInTheDocument();
  });

  it("shows admin action buttons when user is admin", async () => {
    renderWithRoute("admin1");
    emitDoc("tournaments/admin1", baseTournament);
    await screen.findByText("Club Championship");
    expect(
      screen.getByRole("button", { name: /Edit tournament/i })
    ).toBeInTheDocument();
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
    // Registration snapshot with a team of 2 (so 2 open spots)
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
    // Expect the open spots indicator text
    expect(screen.getByText(/2 Spots Open/i)).toBeInTheDocument();
    // Expect the +2 badge (aria-label)
    expect(screen.getByLabelText(/2 open team spots?/i)).toBeInTheDocument();
  });

  it("filters to show only teams needing players when toggle active", async () => {
    renderWithRoute("filter1");
    emitDoc("tournaments/filter1", { ...baseTournament, players: 4 });
    // Two registrations: one full (4 players), one needing 2 players
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
    // Both teams visible initially
    expect(screen.getByText(/Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();
    // Activate filter
    const toggleBtn = screen.getByRole("button", {
      name: /Toggle show teams needing players/i,
    });
    await act(async () => {
      toggleBtn.click();
    });
    // Wait for filter to hide full team
    await waitFor(() => expect(screen.queryByText(/Team 1/i)).toBeNull());
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Spots Open/i)).toBeInTheDocument();
    // Toggle off restores full team
    await act(async () => {
      toggleBtn.click();
    });
    await screen.findByText(/Team 1/i);
  });
});
