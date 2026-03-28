import { describe, it, expect } from "vitest";
import {
  generateBracket,
  shuffleTeams,
  roundLabel,
} from "@/utils/bracketGenerator";
import type { BracketTeam } from "@/types/bracket";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTeams(n: number): BracketTeam[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `Team ${i + 1}`,
    memberIds: [`user-${i + 1}`],
  }));
}

// ── roundLabel ────────────────────────────────────────────────────────────────

describe("roundLabel", () => {
  it("labels the last round as Final", () => {
    expect(roundLabel(3, 3)).toBe("Final");
  });

  it("labels the penultimate round as Semi Finals", () => {
    expect(roundLabel(2, 3)).toBe("Semi Finals");
  });

  it("labels round totalRounds-2 as Quarter Finals", () => {
    expect(roundLabel(2, 4)).toBe("Quarter Finals");
  });

  it("labels earlier rounds with a number", () => {
    expect(roundLabel(1, 4)).toBe("Round 1");
    expect(roundLabel(1, 5)).toBe("Round 1");
    expect(roundLabel(2, 5)).toBe("Round 2");
  });
});

// ── shuffleTeams ──────────────────────────────────────────────────────────────

describe("shuffleTeams", () => {
  it("returns the same number of teams", () => {
    const teams = makeTeams(8);
    expect(shuffleTeams(teams)).toHaveLength(8);
  });

  it("contains every original team", () => {
    const teams = makeTeams(8);
    const result = shuffleTeams(teams);
    const originalIds = new Set(teams.map((t) => t.id));
    expect(result.every((t) => originalIds.has(t.id))).toBe(true);
  });

  it("does not mutate the original array", () => {
    const teams = makeTeams(4);
    const copy = [...teams];
    shuffleTeams(teams);
    expect(teams).toEqual(copy);
  });
});

// ── generateBracket ───────────────────────────────────────────────────────────

describe("generateBracket", () => {
  it("throws when fewer than 2 teams are provided", () => {
    expect(() => generateBracket("t1", [])).toThrow();
    expect(() => generateBracket("t1", makeTeams(1))).toThrow();
  });

  it("sets the correct tournamentId and format", () => {
    const bracket = generateBracket("tour-abc", makeTeams(4));
    expect(bracket.tournamentId).toBe("tour-abc");
    expect(bracket.format).toBe("single_elimination");
  });

  it("pads size to next power of 2", () => {
    expect(generateBracket("t1", makeTeams(2)).size).toBe(2);
    expect(generateBracket("t1", makeTeams(3)).size).toBe(4);
    expect(generateBracket("t1", makeTeams(4)).size).toBe(4);
    expect(generateBracket("t1", makeTeams(5)).size).toBe(8);
    expect(generateBracket("t1", makeTeams(8)).size).toBe(8);
    expect(generateBracket("t1", makeTeams(9)).size).toBe(16);
  });

  it("assigns sequential seed numbers to teams", () => {
    const bracket = generateBracket("t1", makeTeams(4));
    const seeds = bracket.teams.map((t) => t.seed).sort((a, b) => a! - b!);
    expect(seeds).toEqual([1, 2, 3, 4]);
  });

  it("preserves all team ids in the bracket", () => {
    const teams = makeTeams(6);
    const bracket = generateBracket("t1", teams);
    const inputIds = new Set(teams.map((t) => t.id));
    expect(bracket.teams.every((t) => inputIds.has(t.id))).toBe(true);
  });

  it("generates the correct number of matches for a power-of-2 bracket", () => {
    // size 4 → 2 rounds → 2 + 1 = 3 matches
    expect(generateBracket("t1", makeTeams(4)).matches).toHaveLength(3);
    // size 8 → 3 rounds → 4 + 2 + 1 = 7 matches
    expect(generateBracket("t1", makeTeams(8)).matches).toHaveLength(7);
    // size 16 → 4 rounds → 8 + 4 + 2 + 1 = 15 matches
    expect(generateBracket("t1", makeTeams(16)).matches).toHaveLength(15);
  });

  it("wires nextMatchId correctly for every non-final match", () => {
    const { matches } = generateBracket("t1", makeTeams(8));
    const finalMatch = matches.find((m) => m.round === 3);
    expect(finalMatch?.nextMatchId).toBeNull();

    const nonFinal = matches.filter((m) => m.round < 3);
    expect(nonFinal.every((m) => m.nextMatchId !== null)).toBe(true);
  });

  it("places seed 1 (top team) against the lowest seed in round 1", () => {
    // 4-team bracket: standard positions [1,4,2,3] → match (1v4) and (2v3)
    const teams = makeTeams(4);
    const { matches, teams: seeded } = generateBracket("t1", teams);
    const round1 = matches.filter((m) => m.round === 1);
    const matchWithSeed1 = round1.find(
      (m) =>
        m.team1Id === seeded.find((t) => t.seed === 1)?.id ||
        m.team2Id === seeded.find((t) => t.seed === 1)?.id,
    );
    const opponentId =
      matchWithSeed1?.team1Id === seeded.find((t) => t.seed === 1)?.id
        ? matchWithSeed1?.team2Id
        : matchWithSeed1?.team1Id;
    const opponentSeed = seeded.find((t) => t.id === opponentId)?.seed;
    // Seed 1 should play seed 4
    expect(opponentSeed).toBe(4);
  });

  it("gives seed 1 a bye when team count is not a power of 2", () => {
    // 3 teams → size 4 → positions [1,4,2,3]; seed 4 is a bye, so seed 1 has no opponent
    const { matches, teams: seeded } = generateBracket("t1", makeTeams(3));
    const seed1Id = seeded.find((t) => t.seed === 1)!.id;
    const matchWithSeed1 = matches.find(
      (m) => m.round === 1 && (m.team1Id === seed1Id || m.team2Id === seed1Id),
    )!;
    const opponentId =
      matchWithSeed1.team1Id === seed1Id
        ? matchWithSeed1.team2Id
        : matchWithSeed1.team1Id;
    // The opponent slot should be null (bye)
    expect(opponentId).toBeNull();
  });

  it("every match id is unique", () => {
    const { matches } = generateBracket("t1", makeTeams(8));
    const ids = matches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all winners start as null (bracket not yet played)", () => {
    const { matches } = generateBracket("t1", makeTeams(8));
    expect(matches.every((m) => m.winnerId === null)).toBe(true);
  });

  it("round 1 matches beyond the first round have null team slots (not pre-filled)", () => {
    const { matches } = generateBracket("t1", makeTeams(4));
    const laterRounds = matches.filter((m) => m.round > 1);
    expect(
      laterRounds.every((m) => m.team1Id === null && m.team2Id === null),
    ).toBe(true);
  });
});
