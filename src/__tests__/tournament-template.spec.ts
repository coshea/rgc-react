import { describe, it, expect } from "vitest";
import { buildTournamentTemplate } from "@/utils/tournamentTemplate";
import { TournamentStatus, type Tournament } from "@/types/tournament";

describe("buildTournamentTemplate", () => {
  const source: Tournament = {
    firestoreId: "2025-fall-classic",
    title: "Fall Classic",
    description: "Bracket event",
    detailsMarkdown: "Details",
    players: 2,
    prizePool: 400,
    tee: "Blue",
    assignedTeeTimes: true,
    status: TournamentStatus.Completed,
    date: new Date("2025-08-14T00:00:00.000Z"),
    winnerGroups: [
      { id: "g1", label: "Overall", type: "overall", order: 0, winners: [] },
    ],
    bracketRoundPayouts: [
      { round: 1, amount: 25 },
      { round: 2, amount: 60, runnerUpAmount: 15 },
    ],
  };

  it("copies reusable settings, including bracket payouts", () => {
    const template = buildTournamentTemplate(source);
    expect(template).toEqual({
      title: "Fall Classic",
      description: "Bracket event",
      detailsMarkdown: "Details",
      players: 2,
      prizePool: 400,
      tee: "Blue",
      assignedTeeTimes: true,
      bracketRoundPayouts: [
        { round: 1, amount: 25 },
        { round: 2, amount: 60, runnerUpAmount: 15 },
      ],
    });
  });

  it("leaves out event-specific fields and copies payouts by value", () => {
    const template = buildTournamentTemplate(source);
    expect(template).not.toHaveProperty("date");
    expect(template).not.toHaveProperty("winnerGroups");
    expect(template).not.toHaveProperty("firestoreId");
    expect(template.bracketRoundPayouts?.[0]).not.toBe(
      source.bracketRoundPayouts?.[0],
    );
  });
});
