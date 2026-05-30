import { describe, expect, it } from "vitest";

import { collectNewHeadToHeadMatches } from "../notifyBracketMatchup";

describe("collectNewHeadToHeadMatches", () => {
  it("returns empty when no matches are available", () => {
    expect(collectNewHeadToHeadMatches(undefined, undefined)).toEqual([]);
    expect(collectNewHeadToHeadMatches({}, { matches: [] })).toEqual([]);
  });

  it("detects first-time head-to-head matchups", () => {
    const result = collectNewHeadToHeadMatches(undefined, {
      matches: [
        { id: "m1", round: 1, team1Id: "team-a", team2Id: "team-b" },
        { id: "m2", round: 1, team1Id: "team-c", team2Id: null },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      matchId: "m1",
      round: 1,
      team1Id: "team-a",
      team2Id: "team-b",
    });
  });

  it("ignores BYE pairings", () => {
    const result = collectNewHeadToHeadMatches(
      {
        matches: [{ id: "m1", round: 1, team1Id: "team-a", team2Id: null }],
      },
      {
        matches: [{ id: "m1", round: 1, team1Id: "team-a", team2Id: null }],
      },
    );

    expect(result).toEqual([]);
  });

  it("does not re-emit unchanged matchups", () => {
    const before = {
      matches: [{ id: "m1", round: 2, team1Id: "team-a", team2Id: "team-b" }],
    };
    const after = {
      matches: [{ id: "m1", round: 2, team1Id: "team-b", team2Id: "team-a" }],
    };

    expect(collectNewHeadToHeadMatches(before, after)).toEqual([]);
  });

  it("emits when pairing changes to a new opponent", () => {
    const before = {
      matches: [{ id: "m5", round: 2, team1Id: "team-a", team2Id: "team-b" }],
    };
    const after = {
      matches: [{ id: "m5", round: 2, team1Id: "team-a", team2Id: "team-c" }],
    };

    const result = collectNewHeadToHeadMatches(before, after);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      matchId: "m5",
      round: 2,
      team1Id: "team-a",
      team2Id: "team-c",
    });
  });

  it("emits when a match transitions from BYE to real pairing", () => {
    const before = {
      matches: [{ id: "m8", round: 3, team1Id: "team-x", team2Id: null }],
    };
    const after = {
      matches: [{ id: "m8", round: 3, team1Id: "team-x", team2Id: "team-y" }],
    };

    const result = collectNewHeadToHeadMatches(before, after);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      matchId: "m8",
      round: 3,
      team1Id: "team-x",
      team2Id: "team-y",
    });
  });
});
