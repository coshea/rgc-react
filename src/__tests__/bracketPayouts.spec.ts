import { describe, expect, it } from "vitest";

import {
  buildBracketWinnerGroups,
  isAutomatedBracketWinnerGroup,
  isBracketRoundGroup,
  mergeBracketWinnerGroups,
  normalizeBracketRoundPayouts,
} from "@/utils/bracketPayouts";
import type { TournamentBracket } from "@/types/bracket";
import type { WinnerGroup } from "@/types/winner";

const BRACKET: TournamentBracket = {
  tournamentId: "t1",
  format: "single_elimination",
  size: 4,
  teams: [
    {
      id: "team-a",
      name: "Alice, Bob",
      memberIds: ["u1", "u2"],
      memberNames: ["Alice", "Bob"],
      seed: 1,
    },
    {
      id: "team-b",
      name: "Carol, Dave",
      memberIds: ["u3", "u4"],
      memberNames: ["Carol", "Dave"],
      seed: 2,
    },
    {
      id: "team-c",
      name: "Eve, Frank",
      memberIds: ["u5", "u6"],
      memberNames: ["Eve", "Frank"],
      seed: 3,
    },
    {
      id: "team-d",
      name: "Grace, Heidi",
      memberIds: ["u7", "u8"],
      memberNames: ["Grace", "Heidi"],
      seed: 4,
    },
  ],
  matches: [
    {
      id: "m1",
      round: 1,
      position: 0,
      nextMatchId: "m3",
      team1Id: "team-a",
      team2Id: "team-b",
      winnerId: "team-a",
    },
    {
      id: "m2",
      round: 1,
      position: 1,
      nextMatchId: "m3",
      team1Id: "team-c",
      team2Id: "team-d",
      winnerId: "team-d",
    },
    {
      id: "m3",
      round: 2,
      position: 0,
      nextMatchId: null,
      team1Id: "team-a",
      team2Id: "team-d",
      winnerId: "team-d",
    },
  ],
};

describe("buildBracketWinnerGroups", () => {
  it("creates one overall standings group with tied placements and total payouts", () => {
    const groups = buildBracketWinnerGroups(BRACKET, [
      { round: 1, amount: 25 },
      { round: 2, amount: 100, runnerUpAmount: 40 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Bracket Standings");
    expect(groups[0]?.type).toBe("overall");
    expect(groups[0]?.winners).toHaveLength(2);
    expect(groups[0]?.winners?.[0]).toEqual({
      id: "team-d:standings",
      place: 1,
      competitors: [
        { userId: "u7", displayName: "Grace" },
        { userId: "u8", displayName: "Heidi" },
      ],
      prizeAmount: 125,
    });
    expect(groups[0]?.winners?.[1]).toEqual({
      id: "team-a:standings",
      place: 2,
      competitors: [
        { userId: "u1", displayName: "Alice" },
        { userId: "u2", displayName: "Bob" },
      ],
      prizeAmount: 65,
    });
    expect(groups[0]?.winners?.some((winner) => winner.prizeAmount === 0)).toBe(
      false,
    );
  });

  it("keeps automated bracket groups separate from manual groups", () => {
    const generated = buildBracketWinnerGroups(BRACKET, [
      { round: 1, amount: 25 },
    ]);

    expect(isAutomatedBracketWinnerGroup(generated[0]!)).toBe(true);
    expect(isBracketRoundGroup(generated[0]!)).toBe(false);
  });

  it("assigns tied placements by elimination round in a full 8-team bracket", () => {
    const expandedBracket: TournamentBracket = {
      tournamentId: "t2",
      format: "single_elimination",
      size: 8,
      teams: [
        { id: "t1", name: "T1", memberIds: ["u1"] },
        { id: "t2", name: "T2", memberIds: ["u2"] },
        { id: "t3", name: "T3", memberIds: ["u3"] },
        { id: "t4", name: "T4", memberIds: ["u4"] },
        { id: "t5", name: "T5", memberIds: ["u5"] },
        { id: "t6", name: "T6", memberIds: ["u6"] },
        { id: "t7", name: "T7", memberIds: ["u7"] },
        { id: "t8", name: "T8", memberIds: ["u8"] },
      ],
      matches: [
        {
          id: "m1",
          round: 1,
          position: 0,
          nextMatchId: "m5",
          team1Id: "t1",
          team2Id: "t2",
          winnerId: "t1",
        },
        {
          id: "m2",
          round: 1,
          position: 1,
          nextMatchId: "m5",
          team1Id: "t3",
          team2Id: "t4",
          winnerId: "t3",
        },
        {
          id: "m3",
          round: 1,
          position: 2,
          nextMatchId: "m6",
          team1Id: "t5",
          team2Id: "t6",
          winnerId: "t5",
        },
        {
          id: "m4",
          round: 1,
          position: 3,
          nextMatchId: "m6",
          team1Id: "t7",
          team2Id: "t8",
          winnerId: "t7",
        },
        {
          id: "m5",
          round: 2,
          position: 0,
          nextMatchId: "m7",
          team1Id: "t1",
          team2Id: "t3",
          winnerId: "t1",
        },
        {
          id: "m6",
          round: 2,
          position: 1,
          nextMatchId: "m7",
          team1Id: "t5",
          team2Id: "t7",
          winnerId: "t7",
        },
        {
          id: "m7",
          round: 3,
          position: 0,
          nextMatchId: null,
          team1Id: "t1",
          team2Id: "t7",
          winnerId: "t7",
        },
      ],
    };

    const group = buildBracketWinnerGroups(expandedBracket, [
      { round: 1, amount: 10 },
      { round: 2, amount: 20 },
      { round: 3, amount: 30 },
    ])[0]!;

    expect(group.winners.map((winner) => winner.place)).toEqual([1, 2, 3, 3]);
  });

  it("marks a team eliminated even when the loss happens in a round with no payout entry", () => {
    const expandedBracket: TournamentBracket = {
      tournamentId: "t3",
      format: "single_elimination",
      size: 8,
      teams: [
        { id: "t1", name: "T1", memberIds: ["u1"] },
        { id: "t2", name: "T2", memberIds: ["u2"] },
        { id: "t3", name: "T3", memberIds: ["u3"] },
        { id: "t4", name: "T4", memberIds: ["u4"] },
        { id: "t5", name: "T5", memberIds: ["u5"] },
        { id: "t6", name: "T6", memberIds: ["u6"] },
        { id: "t7", name: "T7", memberIds: ["u7"] },
        { id: "t8", name: "T8", memberIds: ["u8"] },
      ],
      matches: [
        {
          id: "m1",
          round: 1,
          position: 0,
          nextMatchId: "m5",
          team1Id: "t1",
          team2Id: "t2",
          winnerId: "t1",
        },
        {
          id: "m2",
          round: 1,
          position: 1,
          nextMatchId: "m5",
          team1Id: "t3",
          team2Id: "t4",
          winnerId: "t3",
        },
        {
          id: "m3",
          round: 1,
          position: 2,
          nextMatchId: "m6",
          team1Id: "t5",
          team2Id: "t6",
          winnerId: "t5",
        },
        {
          id: "m4",
          round: 1,
          position: 3,
          nextMatchId: "m6",
          team1Id: "t7",
          team2Id: "t8",
          winnerId: "t7",
        },
        {
          id: "m5",
          round: 2,
          position: 0,
          nextMatchId: "m7",
          team1Id: "t1",
          team2Id: "t3",
          winnerId: "t3",
        },
        {
          id: "m6",
          round: 2,
          position: 1,
          nextMatchId: "m7",
          team1Id: "t5",
          team2Id: "t7",
          winnerId: "t7",
        },
        {
          id: "m7",
          round: 3,
          position: 0,
          nextMatchId: null,
          team1Id: "t3",
          team2Id: "t7",
          winnerId: "t7",
        },
      ],
    };

    const groups = buildBracketWinnerGroups(expandedBracket, [
      { round: 1, amount: 25 },
      { round: 3, amount: 100, runnerUpAmount: 40 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.winners.map((winner) => winner.place)).toEqual([
      1, 2, 3, 3,
    ]);
    expect(
      groups[0]?.winners.find(
        (winner) => winner.competitors[0]?.userId === "u1",
      )?.place,
    ).toBe(3);
  });

  it("returns no automated winners when no paid result has been recorded yet", () => {
    const pendingBracket: TournamentBracket = {
      ...BRACKET,
      matches: BRACKET.matches.map((match) => ({ ...match, winnerId: null })),
    };

    const groups = buildBracketWinnerGroups(pendingBracket, [
      { round: 2, amount: 100, runnerUpAmount: 40 },
    ]);

    expect(groups).toEqual([]);
  });

  it("preserves zero-dollar opening rounds so later rounds do not get renumbered", () => {
    expect(
      normalizeBracketRoundPayouts([
        { round: 1, amount: 0 },
        { round: 2, amount: 100 },
      ]),
    ).toEqual([
      { round: 1, amount: 0 },
      { round: 2, amount: 100 },
    ]);
  });
});

describe("mergeBracketWinnerGroups", () => {
  it("preserves manual groups while replacing automated bracket groups", () => {
    const existing: WinnerGroup[] = [
      {
        id: "manual-overall",
        label: "Overall",
        type: "overall",
        order: 0,
        winners: [],
      },
      {
        id: "bracket-round:1",
        label: "Old Round Winners",
        type: "bracketRound",
        order: 1,
        winners: [],
      },
    ];

    const merged = mergeBracketWinnerGroups(existing, [
      {
        id: "bracket-round:2",
        label: "Final Winners",
        type: "bracketRound",
        order: 0,
        winners: [],
      },
    ]);

    expect(merged).toEqual([
      {
        id: "manual-overall",
        label: "Overall",
        type: "overall",
        order: 0,
        winners: [],
      },
      {
        id: "bracket-round:2",
        label: "Final Winners",
        type: "bracketRound",
        order: 1,
        winners: [],
      },
    ]);
  });
});
