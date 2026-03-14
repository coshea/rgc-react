import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TournamentDetailPage from "@/pages/tournament-detail";
import { TournamentStatus } from "@/types/tournament";
import { openRegistrationWindow } from "./tournament-utils";

// Mock hooks & Auth
let authUserMock: { uid: string } | null = { uid: "user1" };
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: authUserMock }),
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
      }),
    );
  });
}
function emitCollection(
  path: string,
  docs: Array<{ id: string; data: () => any }>,
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

function renderWithRoute(
  id: string,
  entries?: string[],
  initialIndex?: number,
) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={entries ?? [`/t/${id}`]}
        initialIndex={initialIndex}
      >
        <Routes>
          <Route path="/t/:firestoreId" element={<TournamentDetailPage />} />
          <Route
            path="/tournaments"
            element={<div data-testid="tournaments-list">Tournaments List</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseTournament = {
  ...openRegistrationWindow(),
  title: "Club Championship",
  date: new Date(),
  description: "Desc",
  players: 4,
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
    authUserMock = { uid: "user1" };
  });

  it("renders loading then tournament title", async () => {
    renderWithRoute("abc");
    expect(screen.getByText(/Loading tournament/i)).toBeInTheDocument();
    emitDoc("tournaments/abc", baseTournament);
    await waitFor(() =>
      expect(screen.getByText("Club Championship")).toBeInTheDocument(),
    );
  });

  it("back button always navigates to tournaments list", async () => {
    renderWithRoute("back1", ["/tournaments", "/t/back1"], 1);
    emitDoc("tournaments/back1", baseTournament);
    await screen.findByText("Club Championship");
    const backBtns = screen.getAllByRole("button", {
      name: /back/i,
    });
    await act(async () => {
      backBtns[0].click();
    });
    await screen.findByTestId("tournaments-list");
  });

  it("shows registration open chip and register button when open and user not registered", async () => {
    renderWithRoute("open1");
    emitDoc("tournaments/open1", {
      ...baseTournament,
      winners: [],
    });
    await screen.findByText("Club Championship");
    expect(screen.getAllByText(/Registration Open/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Register/i }),
    ).toBeInTheDocument();
  });

  it("shows registered state when user is part of a team", async () => {
    renderWithRoute("reg1");
    emitDoc("tournaments/reg1", {
      ...baseTournament,
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
      expect(screen.getByText(/You're registered/i)).toBeInTheDocument(),
    );
  });

  it("shows closed message when registration closed", async () => {
    renderWithRoute("closed1");
    const pastWindow = {
      registrationStart: new Date(Date.now() - 4 * 60 * 60 * 1000),
      registrationEnd: new Date(Date.now() - 60 * 60 * 1000),
    };
    emitDoc("tournaments/closed1", {
      ...baseTournament,
      ...pastWindow,
      status: TournamentStatus.Upcoming,
    });
    await screen.findByText("Club Championship");
    expect(screen.getByText(/^Registration Closed$/i)).toBeInTheDocument();
  });

  it("does not load registered teams when logged out", async () => {
    authUserMock = null;
    renderWithRoute("loggedout1");
    emitDoc("tournaments/loggedout1", baseTournament);
    await screen.findByText("Club Championship");
    expect(
      screen.getByText(/You must be logged in to view registered teams/i),
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
    // Position badges now show trophy icons with ordinal text, names are in responsive layout
    expect(screen.getAllByText("Champ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Runner").length).toBeGreaterThan(0);
  });

  it("shows admin action buttons when user is admin", async () => {
    renderWithRoute("admin1");
    // Set admin flag via hook mock
    isAdminMock = true;
    emitDoc("tournaments/admin1", baseTournament);
    await screen.findByText("Club Championship");
    await waitFor(
      () =>
        expect(
          screen.getAllByRole("button", { name: /Edit tournament/i }),
        ).toHaveLength(2), // One for mobile, one for desktop
    );
    expect(
      screen.getAllByRole("button", { name: /Delete tournament/i }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /Export registrations/i }),
    ).toHaveLength(2);
  });

  it("highlights teams with open spots", async () => {
    renderWithRoute("spots1");
    emitDoc("tournaments/spots1", { ...baseTournament, players: 4 });
    emitCollection("tournaments/spots1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "u10",
          openSpotsOptIn: true,
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

  it("does not advertise open spots unless opted in", async () => {
    renderWithRoute("spots2");
    emitDoc("tournaments/spots2", { ...baseTournament, players: 4 });
    emitCollection("tournaments/spots2/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "other",
          openSpotsOptIn: false,
          team: [
            { id: "u10", displayName: "Player A" },
            { id: "u11", displayName: "Player B" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");
    expect(screen.queryByText(/Spots Open/i)).toBeNull();
    expect(screen.queryByLabelText(/open team spots?/i)).toBeNull();
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
          ownerId: "e",
          openSpotsOptIn: true,
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

  it("opens the open-spot modal when clicked", async () => {
    renderWithRoute("modal1");
    emitDoc("tournaments/modal1", { ...baseTournament, players: 4 });
    emitCollection("tournaments/modal1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "leader1",
          openSpotsOptIn: true,
          team: [
            { id: "leader1", displayName: "Leader One" },
            { id: "m2", displayName: "Member Two" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");

    const teamCard = screen.getByRole("button", {
      name: /open spot details for team 1/i,
    });
    await act(async () => {
      teamCard.click();
    });

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Team 1/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Leader One/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Member Two/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: /View profile for Leader One/i,
      }),
    ).toBeInTheDocument();
  });

  it("does not show leader chip for single-player tournaments", async () => {
    renderWithRoute("solo1");
    emitDoc("tournaments/solo1", { ...baseTournament, players: 1 });
    emitCollection("tournaments/solo1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "s1",
          team: [{ id: "s1", displayName: "Solo Player" }],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");

    // 'Leader' label should not be present for single-player events
    expect(screen.queryByText(/Leader/i)).toBeNull();
    expect(screen.getByText(/Solo Player/i)).toBeInTheDocument();
  });

  it("marks teams beyond maxTeams as waitlisted", async () => {
    renderWithRoute("wait1");
    emitDoc("tournaments/wait1", { ...baseTournament, maxTeams: 2 });
    emitCollection("tournaments/wait1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "o1",
          team: [{ id: "a", displayName: "A" }],
          registeredAt: { toDate: () => new Date() },
        }),
      },
      {
        id: "r2",
        data: () => ({
          ownerId: "o2",
          team: [{ id: "b", displayName: "B" }],
          registeredAt: { toDate: () => new Date() },
        }),
      },
      {
        id: "r3",
        data: () => ({
          ownerId: "o3",
          team: [{ id: "c", displayName: "C" }],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);

    await screen.findByText("Club Championship");
    expect(screen.getByText(/Field Size/i)).toBeInTheDocument();
    expect(screen.getByText(/2 teams/i)).toBeInTheDocument();
    expect(screen.getByText("3 / 2")).toBeInTheDocument();
    expect(screen.getAllByText(/Waitlist/i).length).toBeGreaterThan(0);
  });

  it("shows gold tee badge on team members with goldTee flag", async () => {
    renderWithRoute("gold1");
    emitDoc("tournaments/gold1", { ...baseTournament, players: 2 });
    emitCollection("tournaments/gold1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "u1",
          team: [
            { id: "u1", displayName: "Alice", goldTee: false },
            { id: "u2", displayName: "Bob", goldTee: true },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");
    // Gold tee badge should appear for Bob but not for Alice
    expect(screen.getByLabelText("Gold tees")).toBeInTheDocument();
  });

  it("CSV export includes goldTee columns per member", async () => {
    // Capture CSV content by spying on the Blob constructor
    let capturedCsv = "";
    const OrigBlob = globalThis.Blob;
    vi.spyOn(globalThis, "Blob").mockImplementationOnce(
      (parts: any, opts: any) => {
        capturedCsv = (parts as string[]).join("");
        return new OrigBlob(parts, opts);
      },
    );
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = () => {};

    isAdminMock = true;
    renderWithRoute("csv1");
    emitDoc("tournaments/csv1", { ...baseTournament, players: 2 });
    emitCollection("tournaments/csv1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "u1",
          team: [
            { id: "u1", displayName: "Alice", goldTee: false },
            { id: "u2", displayName: "Bob", goldTee: true },
          ],
          registeredAt: { toDate: () => new Date("2026-03-01T00:00:00Z") },
        }),
      },
    ]);

    await screen.findByText("Club Championship");

    // Click the Export button (admin-only)
    const exportBtns = await screen.findAllByRole("button", {
      name: /Export registrations/i,
    });
    act(() => {
      exportBtns[0].click();
    });

    vi.restoreAllMocks();

    // Header row should contain goldTee columns
    expect(capturedCsv).toContain("member1_goldTee");
    expect(capturedCsv).toContain("member2_goldTee");
    // Bob's goldTee cell should be "Gold"
    expect(capturedCsv).toContain('"Gold"');
    // Parse to verify column positions
    const lines = capturedCsv.split("\n");
    const dataLine = lines[1];
    // Format: date,member1,member1_goldTee,member2,member2_goldTee
    const cells = dataLine.split(",").map((c) => c.replace(/"/g, ""));
    expect(cells[2]).toBe(""); // Alice goldTee empty
    expect(cells[4]).toBe("Gold"); // Bob goldTee is Gold
  });
});
