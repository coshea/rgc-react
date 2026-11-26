import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { MemberHoverCardBody } from "@/components/member-hover-card";
import type { UserYearlyWinnings } from "@/hooks/useYearlyWinnings";
import type { UnifiedChampionship } from "@/types/championship";

const data = vi.hoisted(() => ({
  winnings: [] as UserYearlyWinnings[],
  championships: [] as UnifiedChampionship[],
}));

vi.mock("@/hooks/useUserById", () => ({
  useUserById: (id: string) => ({
    user: { id, displayName: "Pat Golfer", membershipType: "full" },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/useYearlyWinnings", () => ({
  useYearlyWinnings: () => ({ winnings: data.winnings, isLoading: false }),
}));
vi.mock("@/hooks/useChampionships", () => ({
  useUserChampionships: () => ({
    championships: data.championships,
    isLoading: false,
  }),
}));

const year = new Date().getFullYear();

function earner(userId: string, total: number, firsts = 0): UserYearlyWinnings {
  return {
    userId,
    displayName: userId,
    total,
    tournamentTotal: total,
    seasonAwardsTotal: 0,
    breakdown: Array.from({ length: Math.max(firsts, 1) }, (_, i) => ({
      tournamentId: `${userId}-t${i}`,
      title: "Event",
      date: new Date(),
      amount: total / Math.max(firsts, 1),
      place: i < firsts ? 1 : 2,
      source: "tournament" as const,
    })),
  };
}

function title(type: string, y: number, winnerIds = ["pat"]): UnifiedChampionship {
  return {
    id: `${type}-${y}`,
    year: y,
    championshipType: type,
    winnerNames: ["Pat Golfer"],
    winnerIds,
    isHistorical: false,
  };
}

const renderBody = () =>
  render(
    <MemoryRouter>
      <MemberHoverCardBody userId="pat" />
    </MemoryRouter>,
  );

describe("MemberHoverCardBody", () => {
  beforeEach(() => {
    data.winnings = [];
    data.championships = [];
  });

  it("shows this season's winnings, rank, wins and recent championships", () => {
    data.winnings = [
      earner("pat", 1240, 2),
      earner("b", 300),
      earner("c", 200),
      earner("d", 100),
    ];
    data.championships = [
      title("presidents-cup", year - 1),
      title("club-champion", year),
      title("pisano-cup", year - 3),
      title("club-champion", year - 2, ["someone-else"]),
    ];
    renderBody();

    expect(screen.getByText("$1,240")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText(`${year} wins`).previousSibling?.textContent).toBe("2");
    expect(screen.getByText("Championships").previousSibling?.textContent).toBe(
      "3",
    );

    const shelf = within(screen.getByRole("list", { name: "Championships" }));
    const chips = shelf.getAllByRole("listitem").map((li) => li.textContent);
    expect(chips).toEqual([
      `Club Champion · ${year}`,
      `President's Cup · ${year - 1}`,
      "+1",
    ]);
  });

  it("hides the rank outside the top half and dashes empty stats", () => {
    data.winnings = [earner("a", 900), earner("b", 500), earner("pat", 50)];
    renderBody();

    expect(screen.getByText("$50")).toBeTruthy();
    expect(screen.queryByText(/^#/)).toBeNull();
    expect(screen.getByText(`${year} wins`).previousSibling?.textContent).toBe("–");
    expect(screen.getByText("Championships").previousSibling?.textContent).toBe(
      "–",
    );
    expect(screen.queryByRole("list", { name: "Championships" })).toBeNull();
  });
});
