import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyTeamWinners } from "@/components/yearly-team-winners";

// Mock hooks used inside component
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true }),
}));

vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => ({
    isLoading: false,
    tournaments: [
      {
        firestoreId: "t1",
        title: "Spring Scramble",
        date: new Date(2025, 3, 10),
        description: "",
        players: 40,
        completed: true,
        canceled: false,
        prizePool: 500,
        winners: [
          {
            place: 1,
            userIds: ["A", "B"],
            displayNames: ["Alice", "Bob"],
            prizeAmount: 50,
            score: "65",
          },
          {
            place: 2,
            userIds: ["C", "D"],
            displayNames: ["Carol", "Dan"],
            prizeAmount: 30,
          },
        ],
      },
      {
        firestoreId: "t2",
        title: "Better Ball",
        date: new Date(2025, 4, 12),
        description: "",
        players: 32,
        completed: true,
        canceled: false,
        prizePool: 400,
        winners: [
          {
            place: 3,
            userIds: ["A", "B"],
            displayNames: ["Alice", "Bob"],
            prizeAmount: 20,
          },
          {
            place: 1,
            userIds: ["E", "F"],
            displayNames: ["Evan", "Frank"],
            prizeAmount: 55,
          },
        ],
      },
    ],
  }),
}));

describe("YearlyTeamWinners", () => {
  it("groups teams and shows aggregate stats", () => {
    render(<YearlyTeamWinners year={2025} />);
    expect(screen.getByText(/Team Performance/)).toBeInTheDocument();

    const getStatsLine = (teamName: string) => {
      const nameEl = screen.getByText(teamName);
      // parent div holds name <p> followed by stats <p>
      const container = nameEl.parentElement; // <div> wrapping name + stats
      if (!container) throw new Error("Missing container for team " + teamName);
      const ps = Array.from(container.querySelectorAll("p"));
      // stats line should be second paragraph element
      return ps.find((p) => p !== nameEl) as HTMLParagraphElement;
    };

    // Alice • Bob
    const aliceStats = getStatsLine("Alice • Bob");
    expect(aliceStats).toBeInTheDocument();
    expect(aliceStats.textContent).toMatch(/1\s+win/);
    expect(aliceStats.textContent).toMatch(/2\s+podium/);

    // Evan • Frank
    const evanStats = getStatsLine("Evan • Frank");
    expect(evanStats.textContent).toMatch(/1\s+win/);
    expect(evanStats.textContent).toMatch(/1\s+podium/);

    // Carol • Dan (no wins, 1 podium)
    const carolStats = getStatsLine("Carol • Dan");
    expect(carolStats.textContent).toMatch(/0\s+win/);
    expect(carolStats.textContent).toMatch(/1\s+podium/);
  });

  it("filters teams via search input", () => {
    render(<YearlyTeamWinners year={2025} />);
    const input = screen.getByPlaceholderText(/search team/i);
    // Initially shows all three team name combinations
    screen.getByText("Alice • Bob");
    screen.getByText("Evan • Frank");
    screen.getByText("Carol • Dan");
    fireEvent.change(input, { target: { value: "alice" } });
    // Now only the Alice • Bob team should be visible
    screen.getByText("Alice • Bob");
    expect(screen.queryByText("Evan • Frank")).toBeNull();
    expect(screen.queryByText("Carol • Dan")).toBeNull();
  });
});
