import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  act,
  within,
  fireEvent,
} from "@testing-library/react";
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
  useAdminFlag: () => ({ isAdmin: isAdminMock, loadingAdmin: false }),
  useBoardMemberFlag: () => ({ isBoardMember: false, loadingBoard: false }),
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

function emitBracket(
  id: string,
  bracket: {
    tournamentId: string;
    format: string;
    size: number;
    teams: any[];
    matches: any[];
  } | null,
) {
  act(() => {
    (apiListeners[`brackets/${id}`] || []).forEach((cb) => cb(bracket));
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
  onLookingForTeam: (_id: string, next: any) => {
    // Immediately resolve with an empty list so the section renders without hanging
    next([]);
    return () => {};
  },
  setLookingForTeamPost: vi.fn(async () => {}),
  deleteLookingForTeamPost: vi.fn(async () => {}),
  mapTournamentDoc: (snap: any) => ({ firestoreId: snap.id, ...snap.data() }),
  deleteTournament: vi.fn(async () => {}),
}));

vi.mock("@/api/users", () => ({
  getUsers: async () => [],
  getUserProfile: vi.fn(async () => null),
}));

vi.mock("@/api/brackets", () => ({
  onBracket: (id: string, next: any, _error?: any) => {
    const key = `brackets/${id}`;
    apiListeners[key] = apiListeners[key] || [];
    apiListeners[key].push(next);
    return () => {
      apiListeners[key] = (apiListeners[key] || []).filter((fn) => fn !== next);
    };
  },
}));

vi.mock("@/components/bracket/BracketView", () => ({
  BracketView: () => <div data-testid="bracket-view" />,
  calcBracketDimensions: () => ({ width: 800, height: 600 }),
}));

// Avoid rendering markdown heavy component cost
vi.mock("react-markdown", () => ({
  default: (p: any) => <div data-testid="md">{p.children}</div>,
}));
vi.mock("remark-gfm", () => ({}));

// Mock TournamentEditor lazy import so Suspense fallback resolves immediately
vi.mock("@/components/tournament-editor", () => ({
  TournamentEditor: () => <div data-testid="editor">Editor</div>,
}));

// Shim HeroUI v3 Input so fireEvent.change triggers onValueChange
// Shim HeroUI v3 Card so onPress works as a native onClick in tests
vi.mock("@heroui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@heroui/react")>();

  type CardMockProps = React.PropsWithChildren<
    React.HTMLAttributes<HTMLDivElement> & {
      onPress?: React.MouseEventHandler<HTMLDivElement>;
      "aria-label"?: string;
    }
  >;
  type CardSectionProps = React.PropsWithChildren<{ className?: string }>;
  type CardCompound = React.FC<CardMockProps> & {
    Content: React.FC<CardSectionProps>;
    Header: React.FC<CardSectionProps>;
    Footer: React.FC<CardSectionProps>;
  };

  function CardContentMock({ children, className }: CardSectionProps) {
    return <div className={className}>{children}</div>;
  }

  function CardHeaderMock({ children, className }: CardSectionProps) {
    return <div className={className}>{children}</div>;
  }

  function CardFooterMock({ children, className }: CardSectionProps) {
    return <div className={className}>{children}</div>;
  }

  const CardMock: CardCompound = Object.assign(
    function CardMock({
      children,
      onPress,
      "aria-label": ariaLabel,
      className,
      role,
      tabIndex,
      ...rest
    }: CardMockProps) {
      return (
        <div
          role={onPress ? "button" : role}
          tabIndex={onPress ? 0 : tabIndex}
          aria-label={ariaLabel}
          className={className}
          onClick={onPress}
          {...rest}
        >
          {children}
        </div>
      );
    },
    {
      Content: CardContentMock,
      Header: CardHeaderMock,
      Footer: CardFooterMock,
    },
  );

  return {
    ...actual,
    Card: CardMock,
    Input: ({
      label,
      "aria-label": ariaLabel,
      value,
      onChange,
      onValueChange,
      isClearable: _isClearable,
      onClear: _onClear,
      startContent: _startContent,
      ...rest
    }: any) => (
      <div>
        {label && <label htmlFor={`input-${label}`}>{label}</label>}
        <input
          id={label ? `input-${label}` : undefined}
          aria-label={ariaLabel ?? label}
          value={value ?? ""}
          onChange={(e) => {
            if (onChange) onChange(e);
            if (onValueChange) onValueChange(e.target.value);
          }}
          {...rest}
        />
      </div>
    ),
  };
});

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
      status: TournamentStatus.Completed,
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

  it("uses the lowest-order winner group for defending champion when no overall group exists", async () => {
    renderWithRoute("prev-fallback-1");
    emitDoc("tournaments/prev-fallback-1", {
      ...baseTournament,
      previousTournamentId: "prev-fallback-source",
    });

    emitDoc("tournaments/prev-fallback-source", {
      ...baseTournament,
      date: new Date("2025-08-15T00:00:00.000Z"),
      winnerGroups: [
        {
          id: "flight-b",
          label: "Flight B",
          type: "flight",
          order: 2,
          winners: [
            {
              place: 1,
              competitors: [
                { userId: "u-flight", displayName: "Flight Champ" },
              ],
            },
          ],
        },
        {
          id: "custom-net",
          label: "Net Winners",
          type: "custom",
          order: 0,
          winners: [
            {
              place: 1,
              competitors: [
                { userId: "u-custom", displayName: "Custom Champ" },
              ],
            },
          ],
        },
      ],
    });

    await screen.findByText("Club Championship");
    await screen.findByRole("heading", { name: /Defending Champion/i });

    expect(screen.getAllByText("Custom Champ").length).toBeGreaterThan(0);
    expect(screen.queryByText("Flight Champ")).toBeNull();
  });

  it("shows admin action buttons when user is admin", async () => {
    renderWithRoute("admin1");
    // Set admin flag via hook mock
    isAdminMock = true;
    emitDoc("tournaments/admin1", baseTournament);
    await screen.findByText("Club Championship");

    // Open the mobile admin toggle so mobile buttons are rendered
    const toggleBtns = await screen.findAllByRole("button", {
      name: /Toggle admin actions/i,
    });
    fireEvent.click(toggleBtns[0]);

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

  it("filters registered teams by player name using the search box", async () => {
    renderWithRoute("search1");
    emitDoc("tournaments/search1", baseTournament);
    emitCollection("tournaments/search1/registrations", [
      {
        id: "team1",
        data: () => ({
          ownerId: "owner1",
          team: [
            { id: "p1", displayName: "Alice" },
            { id: "p2", displayName: "Bob" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
      {
        id: "team2",
        data: () => ({
          ownerId: "owner2",
          team: [
            { id: "p3", displayName: "Charlie" },
            { id: "p4", displayName: "Denise" },
          ],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);

    await screen.findByText("Club Championship");
    const searchInput = screen.getByLabelText(
      /Search registered teams by player name/i,
    );
    expect(searchInput).toBeInTheDocument();

    expect(screen.getByText(/Team 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "Charlie" } });
    await waitFor(() => expect(screen.queryByText(/Team 1/i)).toBeNull());
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });
    await waitFor(() =>
      expect(screen.getByText(/Team 1/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Team 2/i)).toBeInTheDocument();
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

  it("shows 'Show Partner Teams' button and 'Seeking a partner team' badge for legacy registrations where ownerId is absent from team array", async () => {
    // Legacy doc: ownerId not stored inside reg.team — displayTeam normalization
    // injects the owner, making the effective team size 2 (full for a 2-player tournament).
    // hasPartnerTeamSlots and the filter must use that same normalized size.
    renderWithRoute("legacy1");
    emitDoc("tournaments/legacy1", { ...baseTournament, players: 2 });
    emitCollection("tournaments/legacy1/registrations", [
      {
        id: "r1",
        data: () => ({
          ownerId: "legacy-owner",
          openSpotsOptIn: true,
          // owner is NOT in team array — the legacy format
          team: [{ id: "member1", displayName: "Member One" }],
          registeredAt: { toDate: () => new Date() },
        }),
      },
    ]);
    await screen.findByText("Club Championship");

    // Filter button must be visible because normalized team size is 2
    expect(
      screen.getByRole("button", {
        name: /Toggle show teams seeking a partner team/i,
      }),
    ).toBeInTheDocument();

    // Card badge should show the partner-team indicator
    expect(screen.getByText(/Seeking a partner team/i)).toBeInTheDocument();
  });

  it("CSV export includes goldTee columns per member", async () => {
    // Capture CSV content by replacing Blob with a subclass (vi.spyOn cannot mock constructors in Vitest 4)
    let capturedCsv = "";
    const OrigBlob = globalThis.Blob;
    class BlobCapture extends OrigBlob {
      constructor(parts?: BlobPart[], opts?: BlobPropertyBag) {
        capturedCsv = (parts as string[]).join("");
        super(parts, opts);
      }
    }
    vi.stubGlobal("Blob", BlobCapture);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:fake",
      revokeObjectURL: () => {},
    });

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

    vi.unstubAllGlobals();

    // Header row should contain new column names
    const lines = capturedCsv.split("\n");
    expect(lines[0]).toContain("Team ID");
    expect(lines[0]).toContain("Handle");
    expect(lines[0]).toContain("GHIN");
    expect(lines[0]).toContain("Tee");
    // Bob's Tee cell should be "Gold"
    expect(capturedCsv).toContain('"Gold"');
    // One row per player: Alice (row 1) then Bob (row 2), both on team r1
    // Format per row: Team ID,Handle,First Name,Last Name,Email,HCP Index,GHIN,Tee
    const aliceCells = lines[1].split(",").map((c) => c.replace(/"/g, ""));
    expect(aliceCells[0]).toBe("r1"); // Team ID
    expect(aliceCells[1]).toBe("Alice"); // Handle
    expect(aliceCells[7]).toBe(""); // Tee empty for Alice
    const bobCells = lines[2].split(",").map((c) => c.replace(/"/g, ""));
    expect(bobCells[0]).toBe("r1"); // Team ID
    expect(bobCells[1]).toBe("Bob"); // Handle
    expect(bobCells[7]).toBe("Gold"); // Tee is Gold for Bob
  });

  describe("Bracket visibility", () => {
    const minimalBracket = {
      tournamentId: "tid",
      format: "single_elimination",
      size: 2,
      teams: [],
      matches: [],
    };

    it("non-admin does not see bracket section when bracketPublished is false", async () => {
      isAdminMock = false;
      renderWithRoute("bv1");
      emitDoc("tournaments/bv1", {
        ...baseTournament,
        bracketPublished: false,
      });
      emitBracket("bv1", minimalBracket);
      await screen.findByText("Club Championship");
      expect(screen.queryByText("Tournament Bracket")).toBeNull();
    });

    it("non-admin sees bracket section when bracketPublished is true", async () => {
      isAdminMock = false;
      renderWithRoute("bv2");
      emitDoc("tournaments/bv2", { ...baseTournament, bracketPublished: true });
      emitBracket("bv2", minimalBracket);
      await screen.findByText("Club Championship");
      await waitFor(() =>
        expect(screen.getByText("Tournament Bracket")).toBeInTheDocument(),
      );
    });

    it("admin sees bracket section with print/PNG controls when bracketPublished is false", async () => {
      isAdminMock = true;
      renderWithRoute("bv3");
      emitDoc("tournaments/bv3", {
        ...baseTournament,
        bracketPublished: false,
      });
      emitBracket("bv3", minimalBracket);
      await screen.findByText("Club Championship");
      await waitFor(() =>
        expect(screen.getByText("Tournament Bracket")).toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: "Print bracket" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Download bracket as PNG" }),
      ).toBeInTheDocument();
    });
  });
});
