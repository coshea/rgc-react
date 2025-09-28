import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyTeamWinners } from "@/components/yearly-team-winners";

// Shared mutable mock data so each test can shape the tournaments & loading state
let mockData: { isLoading: boolean; tournaments: any[] } = {
  isLoading: false,
  tournaments: [],
};

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true }),
}));

vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => mockData,
}));

// Helper builders -----------------------------------------------------------
interface WinnerInput {
  place: number;
  users: string[]; // userIds
  names?: string[]; // display names
  prize: number;
  score?: string;
}

function makeTournament(
  id: string,
  title: string,
  date: Date,
  winners: WinnerInput[]
) {
  return {
    firestoreId: id,
    title,
    date,
    description: "",
    players: 0,
    completed: true,
    canceled: false,
    prizePool: 0,
    winners: winners.map((w) => ({
      place: w.place,
      userIds: w.users,
      displayNames: w.names || w.users,
      prizeAmount: w.prize,
      score: w.score,
    })),
  };
}

describe("YearlyTeamWinners - extended coverage", () => {
  beforeEach(() => {
    mockData = { isLoading: false, tournaments: [] };
  });

  it("shows loading skeletons while loading", () => {
    mockData.isLoading = true;
    const { container } = render(<YearlyTeamWinners year={2025} />);
    // Expect 3 skeleton placeholder blocks (using class heuristic from component)
    const skeletons = container.querySelectorAll(".h-24");
    expect(skeletons.length).toBe(3);
  });

  it("shows empty state when no team (multi-user) winners exist", () => {
    // Only solo winners (ignored for teams)
    mockData.tournaments = [
      makeTournament("t1", "Solo Event", new Date(2025, 0, 1), [
        { place: 1, users: ["A"], prize: 10 },
      ]),
    ];
    render(<YearlyTeamWinners year={2025} />);
    screen.getByText("2025 Team Performance");
    screen.getByText("No team results for 2025.");
    // Placeholder currently "Search player" in component
    screen.getByPlaceholderText(/search player/i);
  });

  it("shows 'No teams match filter.' when filter excludes all teams", () => {
    // Provide one valid team
    mockData.tournaments = [
      makeTournament("t1", "Scramble", new Date(2025, 1, 2), [
        { place: 1, users: ["A", "B"], names: ["Alice", "Bob"], prize: 50 },
      ]),
    ];
    render(<YearlyTeamWinners year={2025} />);
    const input = screen.getByPlaceholderText(/search player/i);
    fireEvent.change(input, { target: { value: "zzzzz" } });
    screen.getByText("No teams match filter.");
  });

  it("sorts teams by wins, podiums, totalPerPlayer, then team size (with team size tiebreaker)", () => {
    // Team AB: 2 wins -> always first
    // Teams CD vs EFG: 0 wins each, 3 podiums each, equal totalPerPlayer after adjustment -> size tiebreaker puts EFG (size 3) before CD (size 2)
    mockData.tournaments = [
      makeTournament("t1", "Event 1", new Date(2025, 0, 1), [
        { place: 1, users: ["A", "B"], names: ["A", "B"], prize: 60 },
        { place: 2, users: ["C", "D"], names: ["C", "D"], prize: 40 },
        { place: 3, users: ["E", "F", "G"], names: ["E", "F", "G"], prize: 30 },
      ]),
      makeTournament("t2", "Event 2", new Date(2025, 1, 1), [
        { place: 1, users: ["A", "B"], names: ["A", "B"], prize: 60 },
        { place: 2, users: ["E", "F", "G"], names: ["E", "F", "G"], prize: 40 },
        { place: 3, users: ["C", "D"], names: ["C", "D"], prize: 30 }, // adjust to force total tie with EFG
      ]),
      makeTournament("t3", "Event 3", new Date(2025, 2, 1), [
        { place: 2, users: ["C", "D"], names: ["C", "D"], prize: 40 },
        { place: 3, users: ["E", "F", "G"], names: ["E", "F", "G"], prize: 40 },
      ]),
    ];
    const { container } = render(<YearlyTeamWinners year={2025} />);
    const nameEls = Array.from(container.querySelectorAll("p.font-medium"))
      .map((el) => el.textContent?.trim())
      .filter(Boolean);
    // Expect order: AB (2 wins) -> EFG (1 win,3 podiums, total 150,size3) -> CD(1 win,3 podiums,total150,size2)
    expect(nameEls.slice(0, 3)).toEqual(["A • B", "E • F • G", "C • D"]);
  });

  it("sorts tournaments inside team card by date ascending", () => {
    mockData.tournaments = [
      makeTournament("t1", "C Event", new Date(2025, 2, 1), [
        { place: 1, users: ["A", "B"], prize: 10 },
      ]),
      makeTournament("t2", "A Event", new Date(2025, 0, 1), [
        { place: 2, users: ["A", "B"], prize: 5 },
      ]),
      makeTournament("t3", "B Event", new Date(2025, 1, 1), [
        { place: 3, users: ["A", "B"], prize: 3 },
      ]),
    ];
    const { container } = render(<YearlyTeamWinners year={2025} />);
    const chipTexts = Array.from(
      container.querySelectorAll(".flex.flex-wrap span.flex-1")
    )
      .map((el) => (el.textContent || "").trim())
      .filter((t) => /Event: /.test(t));
    // Should be A Event, B Event, C Event sequence
    expect(chipTexts[0]).toMatch(/^A Event:/);
    expect(chipTexts[1]).toMatch(/^B Event:/);
    expect(chipTexts[2]).toMatch(/^C Event:/);
  });

  it("formats chip text with trophy for first place and P# for others including prize", () => {
    mockData.tournaments = [
      makeTournament("t1", "One", new Date(2025, 0, 1), [
        { place: 1, users: ["A", "B"], prize: 25 },
      ]),
      makeTournament("t2", "Two", new Date(2025, 1, 1), [
        { place: 2, users: ["A", "B"], prize: 15 },
      ]),
      makeTournament("t3", "Three", new Date(2025, 2, 1), [
        { place: 3, users: ["A", "B"], prize: 10 },
      ]),
      makeTournament("t4", "Four", new Date(2025, 3, 1), [
        { place: 4, users: ["A", "B"], prize: 5 },
      ]),
    ];
    const { container } = render(<YearlyTeamWinners year={2025} />);
    const chipTexts = Array.from(
      container.querySelectorAll(".flex.flex-wrap span, .flex.flex-wrap div")
    )
      .map((el) => el.textContent || "")
      .filter((t) => /(One|Two|Three|Four):/.test(t));
    expect(chipTexts).toContain("One: 🏆 $25");
    expect(chipTexts).toContain("Two: P2 $15");
    expect(chipTexts).toContain("Three: P3 $10");
    expect(chipTexts).toContain("Four: P4 $5");
  });
});
