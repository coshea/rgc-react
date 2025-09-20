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

  it("shows only first place winners list", async () => {
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
    expect(screen.getByText("Champ")).toBeInTheDocument();
    expect(screen.queryByText("Runner")).not.toBeInTheDocument();
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
});
