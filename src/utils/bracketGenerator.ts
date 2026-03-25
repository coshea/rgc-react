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
 * Assigns `size` bracket slots (power-of-2), interleaving teams and byes.
 *
 * - Slot 0 is always the first team in the ordered list (top seed).
 * - If byes exist, slot 1 is a bye paired with the top seed.
 * - Remaining byes are distributed randomly across other pairs.
 */
function arrangeSlots(
  orderedTeams: BracketTeam[],
  size: number,
): (BracketTeam | null)[] {
  const numByes = size - orderedTeams.length;
  const topSeed = orderedTeams[0] ?? null;
  const rest = orderedTeams.slice(1);

  const slots: (BracketTeam | null)[] = new Array(size).fill(null);

  if (numByes === 0) {
    // Full bracket – preserve input order
    orderedTeams.forEach((t, i) => (slots[i] = t));
    return slots;
  }

  let slotIdx = 0;
  let teamIdx = 0;
  let byesLeft = numByes;

  // Reserve the first pair: [top seed, BYE]
  if (topSeed) {
    slots[0] = topSeed;
    slots[1] = null; // BYE
    byesLeft--;
    slotIdx = 2;
  }

  // Distribute remaining byes among the remaining pairs
  const remainingPairs = (size - slotIdx) / 2;
  const pairByeFlags = shuffle([
    ...Array<true>(byesLeft).fill(true),
    ...Array<false>(remainingPairs - byesLeft).fill(false),
  ]);

  for (const hasBye of pairByeFlags) {
    if (hasBye) {
      // Randomly decide whether the bye is first or second in the pair
      if (Math.random() < 0.5) {
        slots[slotIdx] = rest[teamIdx++];
        slots[slotIdx + 1] = null;
      } else {
        slots[slotIdx] = null;
        slots[slotIdx + 1] = rest[teamIdx++];
      }
    } else {
      slots[slotIdx] = rest[teamIdx++];
      slots[slotIdx + 1] = rest[teamIdx++];
    }
    slotIdx += 2;
  }

  return slots;
}

// ── Main export ───────────────────────────────────────────────────────────────

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
  const numRounds = Math.log2(size);
  const slots = arrangeSlots(seededTeams, size);

  // Pre-allocate match IDs in round order so we can wire nextMatchId
  // matchIds[roundIndex][positionIndex] (both 0-based)
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
      let winnerId: string | null = null;

      if (r === 0) {
        // Round 1: assign from pre-arranged slots only; winners are never pre-filled.
        team1Id = slots[pos * 2]?.id ?? null;
        team2Id = slots[pos * 2 + 1]?.id ?? null;
      }

      matches.push({
        id,
        round,
        position: pos,
        nextMatchId,
        team1Id,
        team2Id,
        winnerId,
      });
    }
  }

  return {
    tournamentId,
    format: "single_elimination",
    size,
    teams: seededTeams,
    matches,
  };
}
