import { describe, it, expect } from "vitest";
import type { UserYearlyWinnings } from "@/hooks/useYearlyWinnings";
import {
  ordinal,
  rankStandings,
  summarizeSeason,
} from "@/utils/standings";

const item = (
  tournamentId: string,
  amount: number,
  place = 2,
  source: "tournament" | "season-award" = "tournament",
) => ({
  tournamentId,
  title: tournamentId,
  date: new Date("2025-05-03T00:00:00Z"),
  amount,
  place,
  source,
});

const player = (
  userId: string,
  breakdown: ReturnType<typeof item>[],
): UserYearlyWinnings => {
  const total = breakdown.reduce((s, b) => s + b.amount, 0);
  return {
    userId,
    displayName: userId,
    total,
    tournamentTotal: total,
    seasonAwardsTotal: 0,
    breakdown,
  };
};

const WINNINGS = [
  player("Dan", [item("t1", 100)]),
  player("Greg", [item("t1", 300, 1), item("t2", 200, 1), item("a1", 50, 0, "season-award")]),
  player("Joe", [item("t2", 100)]),
  player("Ken", [item("t1", 120), item("t2", 200)]),
];

describe("standings helpers", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });

  it("ranks by earnings and shares ranks on ties", () => {
    const rows = rankStandings(WINNINGS);
    expect(rows.map((r) => [r.userId, r.rankLabel])).toEqual([
      ["Greg", "1"],
      ["Ken", "2"],
      ["Dan", "T3"],
      ["Joe", "T3"],
    ]);
  });

  it("counts events, wins and awards per player", () => {
    const greg = rankStandings(WINNINGS)[0];
    expect(greg.events).toBe(2);
    expect(greg.wins).toBe(2);
    expect(greg.awards).toBe(50);
  });

  it("summarizes the season", () => {
    expect(summarizeSeason(rankStandings(WINNINGS))).toEqual({
      tournamentsPaid: 1020,
      awardsPaid: 50,
      players: 4,
      tournaments: 2,
    });
  });
});
