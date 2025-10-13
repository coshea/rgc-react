import { describe, it, expect } from "vitest";
import { aggregateWinnings } from "@/hooks/useYearlyWinnings";
import type { Tournament } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import type { WinnerGroup } from "@/types/winner";

function makeTournament(
  id: string,
  date: Date,
  winnerGroups: WinnerGroup[],
  overrides: Partial<Tournament> = {}
): Tournament & { firestoreId: string } {
  return {
    firestoreId: id,
    title: overrides.title || id,
    date,
    description: "d",
    players: 4,
    status: TournamentStatus.Completed,
    prizePool: 500,
    registrationOpen: false,
    winners: overrides.winners || [],
    winnerGroups,
    tee: "Blue",
    ...overrides,
  } as Tournament & { firestoreId: string };
}

describe("aggregateWinnings (grouped)", () => {
  it("sums per-competitor prize from groups", () => {
    const t = makeTournament("g1", new Date(2025, 0, 1), [
      {
        id: "overall",
        label: "Overall",
        type: "overall",
        order: 1,
        winners: [
          {
            place: 1,
            competitors: [
              { userId: "u1", displayName: "Alice" },
              { userId: "u2", displayName: "Bob" },
            ],
            prizeAmount: 100,
          },
          {
            place: 2,
            competitors: [{ userId: "u3", displayName: "Charlie" }],
            prizeAmount: 50,
          },
        ],
      },
    ]);
    const res = aggregateWinnings([t]);
    const u1 = res.find((r) => r.userId === "u1");
    const u2 = res.find((r) => r.userId === "u2");
    const u3 = res.find((r) => r.userId === "u3");
    expect(u1?.total).toBe(100);
    expect(u2?.total).toBe(100);
    expect(u3?.total).toBe(50);
  });

  it("prefers winnerGroups over legacy winners when both exist", () => {
    const t = makeTournament(
      "g2",
      new Date(2025, 0, 2),
      [
        {
          id: "overall",
          label: "Overall",
          type: "overall",
          order: 1,
          winners: [
            {
              place: 1,
              competitors: [{ userId: "u1", displayName: "Alice" }],
              prizeAmount: 200,
            },
          ],
        },
      ],
      {
        winners: [
          {
            place: 1,
            userIds: ["u1"],
            displayNames: ["Alice"],
            prizeAmount: 10,
          },
        ],
      }
    );
    const res = aggregateWinnings([t]);
    const u1 = res.find((r) => r.userId === "u1");
    expect(u1?.total).toBe(200);
  });
});
