import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  YearlyTeamWinners,
  aggregateTeams,
} from "@/components/yearly-team-winners";
import type { WinnerGroup } from "@/types/winner";

// Shim SearchInput so fireEvent.change triggers the onChange prop
vi.mock("@/components/search-input", () => ({
  SearchInput: ({ value, onChange, ariaLabel, placeholder }: any) => (
    <input
      type="text"
      aria-label={ariaLabel ?? placeholder ?? "Search"}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Shared mutable mock data so each test can shape the tournaments & loading state
let mockData: { isLoading: boolean; tournaments: any[] } = {
  isLoading: false,
  tournaments: [],
};

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, user: null }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
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
}

function makeTournament(
  id: string,
  title: string,
  date: string,
  winners: WinnerInput[],
  group: Pick<WinnerGroup, "id" | "label" | "type"> = {
    id: "overall",
    label: "Overall",
    type: "overall",
  },
) {
  return {
    firestoreId: id,
    title,
    date: new Date(date),
    winnerGroups: [
      {
        ...group,
        order: 1,
        winners: winners.map((w) => ({
          place: w.place,
          competitors: w.users.map((u, idx) => ({
            userId: u,
            displayName: w.names?.[idx] || u,
          })),
          prizeAmount: w.prize,
        })),
      },
    ],
  };
}

describe("YearlyTeamWinners - extended coverage", () => {
  beforeEach(() => {
    mockData = { isLoading: false, tournaments: [] };
  });

  it("shows loading skeletons while loading", () => {
    mockData.isLoading = true;
    const { container } = render(<YearlyTeamWinners year={2025} />);
    expect(container.querySelectorAll(".h-56").length).toBe(3);
  });

  it("shows empty state when no team (multi-user) winners exist", () => {
    mockData.tournaments = [
      makeTournament("t1", "Solo Event", "2025-01-01", [
        { place: 1, users: ["A"], prize: 10 },
      ]),
    ];
    render(<YearlyTeamWinners year={2025} />);
    screen.getByText("No team prizes paid in 2025 yet.");
    screen.getByPlaceholderText(/find a team by player/i);
  });

  it("explains when the search matches no team", () => {
    mockData.tournaments = [
      makeTournament("t1", "Scramble", "2025-02-02", [
        { place: 1, users: ["A", "B"], names: ["Alice", "Bob"], prize: 50 },
      ]),
    ];
    render(<YearlyTeamWinners year={2025} />);
    fireEvent.change(screen.getByPlaceholderText(/find a team/i), {
      target: { value: "zzzzz" },
    });
    screen.getByText("No teams include “zzzzz”. Try another name.");
  });

  it("sorts by money, then wins, podiums and team size, sharing ranks on ties", () => {
    const teams = aggregateTeams([
      makeTournament("t1", "Event 1", "2025-01-01", [
        { place: 1, users: ["A", "B"], prize: 60 },
        { place: 2, users: ["C", "D"], prize: 40 },
        { place: 3, users: ["E", "F", "G"], prize: 30 },
      ]),
      makeTournament("t2", "Event 2", "2025-02-01", [
        { place: 1, users: ["A", "B"], prize: 60 },
        { place: 2, users: ["E", "F", "G"], prize: 40 },
        { place: 3, users: ["C", "D"], prize: 30 },
      ]),
      makeTournament("t3", "Event 3", "2025-03-01", [
        { place: 2, users: ["C", "D"], prize: 40 },
        { place: 3, users: ["E", "F", "G"], prize: 40 },
      ]),
    ]);
    expect(teams.map((t) => [t.key, t.rankLabel])).toEqual([
      ["A|B", "1st"],
      ["E|F|G", "T2"],
      ["C|D", "T2"],
    ]);
  });

  it("counts match play rounds toward money but not wins", () => {
    const [team] = aggregateTeams([
      makeTournament(
        "mp",
        "Match Play",
        "2025-06-01",
        [{ place: 1, users: ["A", "B"], prize: 40 }],
        { id: "r1", label: "Round 1", type: "bracketRound" },
      ),
      makeTournament("t2", "Better Ball", "2025-07-01", [
        { place: 2, users: ["A", "B"], prize: 30 },
      ]),
    ]);
    expect(team.totalPerPlayer).toBe(70);
    expect(team.wins).toBe(0);
    expect(team.events).toBe(2);
  });

  it("shows matches won instead of the bracket standings label", () => {
    mockData.tournaments = [
      {
        ...makeTournament(
          "mp",
          "Match Play",
          "2025-08-01",
          [{ place: 2, users: ["A", "B"], names: ["Al", "Bo"], prize: 45 }],
          {
            id: "bracket-round:standings",
            label: "Bracket Standings",
            type: "overall",
          },
        ),
        bracketRoundPayouts: [
          { round: 1, amount: 10 },
          { round: 2, amount: 20 },
          { round: 3, amount: 40, runnerUpAmount: 15 },
        ],
      },
    ];
    render(<YearlyTeamWinners year={2025} />);
    const [row] = within(
      screen.getByRole("list", { name: "Finishes for Al and Bo" }),
    ).getAllByRole("listitem");
    expect(row).toHaveTextContent("Aug 1, won 2 matches");
    expect(row).not.toHaveTextContent("Bracket Standings");
  });

  it("labels finishes 1st, 2nd and Won for match play rounds", () => {
    mockData.tournaments = [
      makeTournament("t1", "One", "2025-01-01", [
        { place: 1, users: ["A", "B"], names: ["Al", "Bo"], prize: 25 },
      ]),
      makeTournament("t2", "Two", "2025-02-01", [
        { place: 2, users: ["A", "B"], names: ["Al", "Bo"], prize: 15 },
      ]),
      makeTournament(
        "t3",
        "Match Play",
        "2025-03-01",
        [{ place: 1, users: ["A", "B"], names: ["Al", "Bo"], prize: 10 }],
        { id: "r2", label: "Round 2", type: "bracketRound" },
      ),
    ];
    render(<YearlyTeamWinners year={2025} />);
    const rows = within(
      screen.getByRole("list", { name: "Finishes for Al and Bo" }),
    ).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "WonMatch PlayMar 1, Round 2$10",
      "2ndTwoFeb 1, Overall$15",
      "1stOneJan 1, Overall$25",
    ]);
  });
});
