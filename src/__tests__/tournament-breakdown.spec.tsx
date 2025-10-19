import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { TournamentBreakdown } from "@/components/tournament-breakdown";

// Mock auth to enable queries
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, user: { uid: "u-admin" } }),
}));

// Provide deterministic user profiles
vi.mock("@/api/users", () => ({
  getUsers: async () => [
    { id: "p1", displayName: "Alice" },
    { id: "p2", displayName: "Bob" },
    { id: "p3", displayName: "Cara" },
    { id: "p4", displayName: "Dan" },
    { id: "p5", displayName: "Eve" },
  ],
}));

// Mock useUsersMap (derives from getUsers normally)
vi.mock("@/hooks/useUsers", async () => {
  const users = [
    { id: "p1", displayName: "Alice" },
    { id: "p2", displayName: "Bob" },
    { id: "p3", displayName: "Cara" },
    { id: "p4", displayName: "Dan" },
    { id: "p5", displayName: "Eve" },
  ];
  const map = new Map(users.map((u) => [u.id, u] as const));
  return {
    useUsersMap: () => ({
      usersMap: map,
      isLoading: false,
      isFetching: false,
      count: users.length,
    }),
    useUsers: () => ({ users, isLoading: false }),
  };
});

// Dynamic tournament data for two events
const janDate = new Date(2024, 0, 10);
const febDate = new Date(2024, 1, 12);

// Helper to build winners arrays
// Event 1: two-person team wins (positions 1), second place solo, third place solo
// Event 2: three distinct solo winners positions 1,2,3
const event1 = {
  firestoreId: "evt1",
  title: "Winter Classic",
  date: janDate,
  description: "",
  players: 0,
  completed: true,
  canceled: false,
  prizePool: 300,
  registrationOpen: false,
  tee: "Blue",
  winners: [
    {
      place: 1,
      displayNames: ["Alice", "Bob"],
      userIds: ["p1", "p2"],
      prizeAmount: 100,
      score: "-5",
    },
    {
      place: 2,
      displayNames: ["Cara"],
      userIds: ["p3"],
      prizeAmount: 60,
      score: "-2",
    },
    {
      place: 3,
      displayNames: ["Dan"],
      userIds: ["p4"],
      prizeAmount: 40,
      score: "E",
    },
  ],
};
const event2 = {
  firestoreId: "evt2",
  title: "Frostbite Open",
  date: febDate,
  description: "",
  players: 0,
  completed: true,
  canceled: false,
  prizePool: 200,
  registrationOpen: false,
  tee: "White",
  winners: [
    {
      place: 1,
      displayNames: ["Eve"],
      userIds: ["p5"],
      prizeAmount: 80,
      score: "-3",
    },
    {
      place: 2,
      displayNames: ["Alice"],
      userIds: ["p1"],
      prizeAmount: 50,
      score: "-1",
    },
    {
      place: 3,
      displayNames: ["Bob"],
      userIds: ["p2"],
      prizeAmount: 30,
      score: "+1",
    },
  ],
};

vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => ({
    tournaments: [event1 as any, event2 as any],
    isLoading: false,
  }),
}));

function renderComponent() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <TournamentBreakdown year={2024} />
    </QueryClientProvider>
  );
}

describe("TournamentBreakdown (redesigned)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders global stats chips with correct aggregate values", () => {
    renderComponent();
    // 2 events
    expect(screen.getByText(/2 events/i)).toBeInTheDocument();
    // Unique winners: p1,p2,p3,p4,p5 => 5
    expect(screen.getByText(/5 unique winners/i)).toBeInTheDocument();
    // Total prize pool 300 + 200 = 500 (formatted with $)
    expect(screen.getByText(/\$500/)).toBeInTheDocument();
    // Avg winners per event: total winner rows = 2(team) +1 +1 +1 +1 +1 = 7 rows across 2 events = 3.5
    expect(screen.getByText(/3\.5 winners \/ event/i)).toBeInTheDocument();
  });

  it("shows podium grouping with aggregated names for team winners", () => {
    renderComponent();
    // Podium for Winter Classic: position 1 should aggregate Alice • Bob
    // Note: We now have both mobile and desktop layouts, so there will be multiple matches
    const aliceBobElements = screen.getAllByText(/Alice • Bob/);
    expect(aliceBobElements.length).toBeGreaterThan(0);
    // Position 2 Cara, Position 3 Dan appear in summary (also duplicated for mobile/desktop)
    expect(screen.getAllByText(/Cara/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dan/).length).toBeGreaterThan(0);
    // Frostbite Open podium includes Eve (1st), Alice (2nd), Bob (3rd)
    expect(screen.getAllByText(/Eve/).length).toBeGreaterThan(0);
  });

  it("expands and shows full results table with correct per-player prize labels", () => {
    renderComponent();
    // Multiple expand buttons (one per event); target the first tournament card's button
    const buttons = screen.getAllByRole("button", {
      name: /show full results/i,
    });
    const btn = buttons[0];
    fireEvent.click(btn);
    // After expansion, HeroUI Table renders with role="grid" rather than native table role
    expect(
      screen.getByRole("grid", { name: /Winter Classic full results/i })
    ).toBeInTheDocument();
    // Team prize shows $100 ea for Alice since team of 2 with 100 each (component labels prizeAmount directly per player) => $100 ea appears in podium but table cell just $100 (no ea since logic uses teamSize >1). In table, we assert raw prize.
    expect(screen.getAllByText(/\$100/).length).toBeGreaterThan(0);
    // Score highlighting: negative scores rendered (e.g., -5 occurs twice for team position 1)
    expect(screen.getAllByText("-5").length).toBeGreaterThan(0);
  });

  it("toggles expand button label and aria-expanded state", () => {
    renderComponent();
    const btn = screen.getAllByRole("button", {
      name: /show full results/i,
    })[0];
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    // Label changes
    expect(btn.textContent?.toLowerCase()).toMatch(/hide full results/);
  });
});
