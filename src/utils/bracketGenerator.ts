/**
 * Tournament bracket generation utilities.
 *
 * Rules:
 * 1. Participant count is flexible – padded to the next power of 2 with byes.
 * 2. Teams are taken in the order given – the caller is responsible for seeding
 *    order. Use `shuffleTeams` to randomise or let the admin drag-reorder.
 * 3. The first team in the list is treated as the top seed and receives the
 *    first bye slot.
 * 4. Remaining byes are distributed randomly across the other pairs.
 */

import type {
  BracketTeam,
  BracketMatch,
  TournamentBracket,
} from "@/types/bracket";

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  if (n <= 1) return 2;
  if ((n & (n - 1)) === 0) return n; // already a power of 2
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns a new array with the same teams in a random order. */
export function shuffleTeams(teams: BracketTeam[]): BracketTeam[] {
  return shuffle(teams);
}

export function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semi Finals";
  if (round === totalRounds - 2) return "Quarter Finals";
  return `Round ${round}`;
}

// ── Slot arrangement ─────────────────────────────────────────────────────────

/**
 * Returns the canonical seed numbers for each slot position using standard
 * single-elimination seeding (recursive NCAA-style):
 *
 *   size 2  → [1, 2]
 *   size 4  → [1, 4, 2, 3]          matches: (1v4), (2v3)
 *   size 8  → [1, 8, 4, 5, 2, 7, 3, 6]  matches: (1v8), (4v5), (2v7), (3v6)
 *
 * Guarantees:
 *   - Seed 1 plays the lowest seed, seed 2 plays the second-lowest, etc.
 *   - Seeds 1 and 2 cannot meet before the final.
 *   - Seeds 1–4 cannot meet before the semis.
 */
function standardSeedPositions(size: number): number[] {
  if (size === 2) return [1, 2];
  const half = standardSeedPositions(size / 2);
  const result: number[] = [];
  for (const s of half) {
    result.push(s);
    result.push(size + 1 - s);
  }
  return result;
}

/**
 * Assigns `size` bracket slots using standard single-elimination seeding.
 * Seed numbers beyond the actual team count become BYEs (null), so top seeds
 * automatically receive the first-round byes.
 */
function arrangeSlots(
  orderedTeams: BracketTeam[],
  size: number,
): (BracketTeam | null)[] {
  const positions = standardSeedPositions(size);
  return positions.map((seedNum) =>
    seedNum <= orderedTeams.length ? (orderedTeams[seedNum - 1] ?? null) : null,
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Internal: builds rounds + matches from a padded slot array that is already
 * a power-of-2 in length. `allTeams` is the flat list of non-null teams that
 * will be stored in the bracket document.
 */
function buildMatchesFromPaddedSlots(
  tournamentId: string,
  paddedSlots: (BracketTeam | null)[],
  allTeams: BracketTeam[],
): TournamentBracket {
  const size = paddedSlots.length;
  const numRounds = Math.log2(size);

  // Pre-allocate match IDs in round order so we can wire nextMatchId
  const matchIds: string[][] = [];
  let counter = 1;
  for (let r = 0; r < numRounds; r++) {
    const count = size / Math.pow(2, r + 1);
    const ids: string[] = [];
    for (let p = 0; p < count; p++) {
      ids.push(`m${counter++}`);
    }
    matchIds.push(ids);
  }

  const matches: BracketMatch[] = [];

  for (let r = 0; r < numRounds; r++) {
    const round = r + 1; // 1-indexed
    const count = size / Math.pow(2, round);

    for (let pos = 0; pos < count; pos++) {
      const id = matchIds[r][pos];
      const nextMatchId =
        r + 1 < numRounds ? matchIds[r + 1][Math.floor(pos / 2)] : null;

      let team1Id: string | null = null;
      let team2Id: string | null = null;

      if (r === 0) {
        team1Id = paddedSlots[pos * 2]?.id ?? null;
        team2Id = paddedSlots[pos * 2 + 1]?.id ?? null;
      }

      matches.push({
        id,
        round,
        position: pos,
        nextMatchId,
        team1Id,
        team2Id,
        winnerId: null,
      });
    }
  }

  return {
    tournamentId,
    format: "single_elimination",
    size,
    teams: allTeams,
    matches,
  };
}

export function generateBracket(
  tournamentId: string,
  teams: BracketTeam[],
): TournamentBracket {
  if (teams.length < 2) {
    throw new Error("At least 2 teams are required to generate a bracket.");
  }

  // Assign seed numbers based on position in the input array
  const seededTeams: BracketTeam[] = teams.map((t, i) => ({
    ...t,
    seed: i + 1,
  }));

  const size = nextPowerOf2(seededTeams.length);
  const slots = arrangeSlots(seededTeams, size);

  return buildMatchesFromPaddedSlots(tournamentId, slots, seededTeams);
}

/**
 * Generates a bracket from an **explicit ordered slot list** where `null`
 * entries represent manual byes. The slot order maps directly to round-1
 * matchups (slot[0] vs slot[1], slot[2] vs slot[3], …) giving the admin full
 * control over which team faces which bye.
 *
 * Seed numbers are assigned sequentially to non-null entries (1, 2, 3, …).
 * If the slot count is not a power of 2, extra null byes are appended.
 */
export function generateBracketFromSlots(
  tournamentId: string,
  explicitSlots: (BracketTeam | null)[],
): TournamentBracket {
  const actualTeams = explicitSlots.filter((t): t is BracketTeam => t !== null);
  if (actualTeams.length < 2) {
    throw new Error("At least 2 teams are required to generate a bracket.");
  }

  // Assign seeds to actual teams in slot order
  let seedCounter = 0;
  const seededSlots: (BracketTeam | null)[] = explicitSlots.map((t) =>
    t ? { ...t, seed: ++seedCounter } : null,
  );
  const seededTeams = seededSlots.filter((t): t is BracketTeam => t !== null);

  const size = nextPowerOf2(seededSlots.length);
  // Pad end with nulls if slot count is not already a power of 2
  const paddedSlots: (BracketTeam | null)[] = [
    ...seededSlots,
    ...Array<null>(size - seededSlots.length).fill(null),
  ];

  return buildMatchesFromPaddedSlots(tournamentId, paddedSlots, seededTeams);
}
