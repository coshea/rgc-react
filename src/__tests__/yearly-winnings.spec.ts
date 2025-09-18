import { describe, it, expect } from "vitest";
import { aggregateWinnings } from "@/hooks/useYearlyWinnings";
import type { Tournament } from "@/types/tournament";
import type { Winner } from "@/types/winner";

function makeTournament(
  id: string,
  date: Date,
  winners: Winner[],
  overrides: Partial<Tournament> = {}
): Tournament & { firestoreId: string } {
  return {
    firestoreId: id,
    title: overrides.title || id,
    date,
    description: "d",
    players: 4,
    completed: true,
    canceled: false,
    prizePool: 500,
    registrationOpen: false,
    winners,
    tee: "Blue",
    ...overrides,
  } as Tournament & { firestoreId: string };
}

describe("aggregateWinnings", () => {
  it("aggregates per-user totals and sorts descending", () => {
    const t1 = makeTournament("t1", new Date(2025, 0, 10), [
      {
        place: 1,
        userIds: ["u1"],
        displayNames: ["Alice"],
        prizeAmount: 100,
      },
      {
        place: 2,
        userIds: ["u2", "u3"],
        displayNames: ["Bob", "Charlie"],
        prizeAmount: 40,
      },
    ]);
    const t2 = makeTournament("t2", new Date(2025, 5, 2), [
      {
        place: 1,
        userIds: ["u2"],
        displayNames: ["Bob"],
        prizeAmount: 120,
      },
    ]);
    const result = aggregateWinnings([t1, t2]);
    // Totals: u2 = 40 + 120 = 160, u1 = 100, u3 = 40
    expect(result.map((r) => r.userId)).toEqual(["u2", "u1", "u3"]);
    const u2 = result[0];
    expect(u2.total).toBe(160);
    expect(u2.breakdown.length).toBe(2);
  });

  it("handles tournaments without winners gracefully", () => {
    const t = makeTournament("t3", new Date(2025, 2, 1), []);
    const res = aggregateWinnings([t]);
    expect(res.length).toBe(0);
  });

  it("deduplicates & sums correctly for team winners", () => {
    const t = makeTournament("t4", new Date(2025, 3, 1), [
      {
        place: 1,
        userIds: ["u1", "u2"],
        displayNames: ["Alice", "Bob"],
        prizeAmount: 75,
      },
      {
        place: 2,
        userIds: ["u1"],
        displayNames: ["Alice"],
        prizeAmount: 25,
      },
    ]);
    const res = aggregateWinnings([t]);
    const alice = res.find((r) => r.userId === "u1");
    expect(alice?.total).toBe(100);
  });
});
