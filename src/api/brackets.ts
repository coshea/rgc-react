/**
 * Firestore helpers for tournament brackets.
 * Collection: brackets/{tournamentId}
 */

import { db } from "@/config/firebase";
import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
} from "firebase/firestore";
import type {
  TournamentBracket,
  BracketMatch,
  BracketTeam,
} from "@/types/bracket";
import type { BracketRoundPayout } from "@/types/tournament";
import type { WinnerGroup } from "@/types/winner";
import {
  buildBracketWinnerGroups,
  mergeBracketWinnerGroups,
  normalizeBracketRoundPayouts,
} from "@/utils/bracketPayouts";

const bracketRef = (tournamentId: string) => doc(db, "brackets", tournamentId);
const tournamentRef = (tournamentId: string) =>
  doc(db, "tournaments", tournamentId);

function parseBracketRoundPayouts(value: unknown): BracketRoundPayout[] {
  if (!Array.isArray(value)) return [];

  return normalizeBracketRoundPayouts(
    value
      .map((entry) => {
        if (typeof entry !== "object" || entry === null) return null;
        const record = entry as Record<string, unknown>;
        const round =
          typeof record.round === "number"
            ? record.round
            : Number(record.round);
        const amount =
          typeof record.amount === "number"
            ? record.amount
            : Number(record.amount);
        const runnerUpAmount =
          typeof record.runnerUpAmount === "number"
            ? record.runnerUpAmount
            : record.runnerUpAmount === undefined
              ? undefined
              : Number(record.runnerUpAmount);

        if (!Number.isFinite(round) || !Number.isFinite(amount)) return null;
        if (runnerUpAmount !== undefined && !Number.isFinite(runnerUpAmount)) {
          return null;
        }
        return {
          round,
          amount,
          ...(runnerUpAmount !== undefined ? { runnerUpAmount } : {}),
        } satisfies BracketRoundPayout;
      })
      .filter((entry): entry is BracketRoundPayout => entry !== null),
  );
}

function parseWinnerGroups(value: unknown): WinnerGroup[] {
  return Array.isArray(value) ? (value as WinnerGroup[]) : [];
}

async function syncTournamentBracketWinnerGroups(
  tournamentId: string,
  nextBracket: TournamentBracket | null,
  batch?: ReturnType<typeof writeBatch>,
  options?: {
    existingGroups?: WinnerGroup[];
    roundPayouts?: BracketRoundPayout[];
    persistRoundPayouts?: BracketRoundPayout[];
  },
): Promise<WinnerGroup[]> {
  const tournamentSnap = await getDoc(tournamentRef(tournamentId));
  if (!tournamentSnap.exists()) return [];

  const data = tournamentSnap.data() as Record<string, unknown>;
  const existingGroups =
    options?.existingGroups ?? parseWinnerGroups(data.winnerGroups);
  const roundPayouts =
    options?.roundPayouts ?? parseBracketRoundPayouts(data.bracketRoundPayouts);
  const mergedWinnerGroups = mergeBracketWinnerGroups(
    existingGroups,
    buildBracketWinnerGroups(nextBracket, roundPayouts),
  );
  const payload: Record<string, unknown> = {
    winnerGroups: stripUndefined(mergedWinnerGroups),
  };

  if (options?.persistRoundPayouts) {
    payload.bracketRoundPayouts = stripUndefined(options.persistRoundPayouts);
  } else if (options && "persistRoundPayouts" in options) {
    payload.bracketRoundPayouts = deleteField();
  }

  if (batch) {
    batch.set(tournamentRef(tournamentId), payload, { merge: true });
    return mergedWinnerGroups;
  }

  await setDoc(tournamentRef(tournamentId), payload, { merge: true });
  return mergedWinnerGroups;
}

export async function recalculateTournamentBracketPayouts(params: {
  tournamentId: string;
  bracketRoundPayouts: BracketRoundPayout[];
  existingWinnerGroups?: WinnerGroup[];
}): Promise<{
  bracket: TournamentBracket | null;
  winnerGroups: WinnerGroup[];
  bracketRoundPayouts: BracketRoundPayout[];
}> {
  const [tournamentSnap, bracketSnap] = await Promise.all([
    getDoc(tournamentRef(params.tournamentId)),
    getDoc(bracketRef(params.tournamentId)),
  ]);

  if (!tournamentSnap.exists()) {
    throw new Error("Tournament not found.");
  }

  const normalizedPayouts = normalizeBracketRoundPayouts(
    params.bracketRoundPayouts,
  );
  const bracket = bracketSnap.exists()
    ? (() => {
        const { createdAt: _c, updatedAt: _u, ...rest } = bracketSnap.data();
        return rest as TournamentBracket;
      })()
    : null;

  const winnerGroups = await syncTournamentBracketWinnerGroups(
    params.tournamentId,
    bracket,
    undefined,
    {
      existingGroups:
        params.existingWinnerGroups ??
        parseWinnerGroups(tournamentSnap.data().winnerGroups),
      roundPayouts: normalizedPayouts,
      persistRoundPayouts: normalizedPayouts,
    },
  );

  return {
    bracket,
    winnerGroups,
    bracketRoundPayouts: normalizedPayouts,
  };
}

// ── One-off fetch ────────────────────────────────────────────────────────────

export async function fetchBracket(
  tournamentId: string,
): Promise<TournamentBracket | null> {
  const snap = await getDoc(bracketRef(tournamentId));
  if (!snap.exists()) return null;
  const { createdAt: _c, updatedAt: _u, ...rest } = snap.data();
  return rest as TournamentBracket;
}

// ── Real-time listener ───────────────────────────────────────────────────────

export function onBracket(
  tournamentId: string,
  next: (bracket: TournamentBracket | null) => void,
  onError?: (err: FirestoreError) => void,
) {
  return onSnapshot(
    bracketRef(tournamentId),
    (snap) => {
      if (!snap.exists()) {
        next(null);
        return;
      }
      const { createdAt: _c, updatedAt: _u, ...rest } = snap.data();
      next(rest as TournamentBracket);
    },
    onError,
  );
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Recursively removes keys whose value is `undefined` so Firestore doesn't
 * reject the document with "Unsupported field value: undefined".
 */
function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return obj;
}

export async function saveBracket(bracket: TournamentBracket): Promise<void> {
  const batch = writeBatch(db);
  batch.set(bracketRef(bracket.tournamentId), {
    ...stripUndefined(bracket),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await syncTournamentBracketWinnerGroups(bracket.tournamentId, bracket, batch);
  await batch.commit();
}

// ── Advance a team to the next round ────────────────────────────────────────

export async function advanceTeam(
  tournamentId: string,
  currentBracket: TournamentBracket,
  matchId: string,
  winnerId: string,
): Promise<void> {
  const matches = currentBracket.matches.map((m) => ({ ...m }));
  const matchIdx = matches.findIndex((m) => m.id === matchId);
  if (matchIdx === -1) return;

  const match = matches[matchIdx];
  const prevWinnerId = match.winnerId;

  // If a different winner was previously recorded, clear all downstream picks
  if (prevWinnerId && prevWinnerId !== winnerId && match.nextMatchId) {
    clearDownstream(matches, match.id, prevWinnerId);
  }

  match.winnerId = winnerId;

  // Propagate winner to the appropriate slot in the next match
  if (match.nextMatchId) {
    const nextMatch = matches.find((m) => m.id === match.nextMatchId);
    if (nextMatch) {
      if (match.position % 2 === 0) {
        nextMatch.team1Id = winnerId;
      } else {
        nextMatch.team2Id = winnerId;
      }
    }
  }

  const nextBracket: TournamentBracket = {
    ...currentBracket,
    matches,
  };
  const batch = writeBatch(db);
  batch.set(
    bracketRef(tournamentId),
    { matches, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await syncTournamentBracketWinnerGroups(tournamentId, nextBracket, batch);
  await batch.commit();
}

// ── Save multiple match results at once ──────────────────────────────────────

/**
 * Apply a batch of winner selections to the bracket in one Firestore write.
 * Updates are processed in round order so winner propagation cascades correctly.
 */
export async function saveMatchResults(
  tournamentId: string,
  currentBracket: TournamentBracket,
  updates: Record<string, string>, // matchId → winnerId
): Promise<void> {
  if (Object.keys(updates).length === 0) return;

  const matches = currentBracket.matches.map((m) => ({ ...m }));

  // Process rounds in ascending order so propagation is correct
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  const sortedMatchIds = Object.keys(updates).sort((a, b) => {
    const ra = matchMap.get(a)?.round ?? 0;
    const rb = matchMap.get(b)?.round ?? 0;
    return ra - rb;
  });

  for (const matchId of sortedMatchIds) {
    // Empty string means "clear this match's result"
    const rawWinnerId = updates[matchId];
    const winnerId = rawWinnerId || null;
    const matchIdx = matches.findIndex((m) => m.id === matchId);
    if (matchIdx === -1) continue;

    const match = matches[matchIdx];
    const prevWinnerId = match.winnerId;

    // If a winner was previously recorded, clear all downstream picks
    if (prevWinnerId && match.nextMatchId) {
      clearDownstream(matches, match.id, prevWinnerId);
    }

    match.winnerId = winnerId;

    // Propagate new winner to the appropriate slot in the next match
    if (winnerId && match.nextMatchId) {
      const nextMatch = matches.find((m) => m.id === match.nextMatchId);
      if (nextMatch) {
        if (match.position % 2 === 0) {
          nextMatch.team1Id = winnerId;
        } else {
          nextMatch.team2Id = winnerId;
        }
      }
    }
  }

  const nextBracket: TournamentBracket = {
    ...currentBracket,
    matches,
  };
  const batch = writeBatch(db);
  batch.set(
    bracketRef(tournamentId),
    { matches, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await syncTournamentBracketWinnerGroups(tournamentId, nextBracket, batch);
  await batch.commit();
}

/**
 * Recursively clear a team's propagated placements after their winner was
 * changed or reset. Iterative implementation to avoid deep call stacks.
 */
function clearDownstream(
  matches: BracketMatch[],
  matchId: string,
  prevWinnerId: string,
): void {
  const queue = [matchId];
  while (queue.length > 0) {
    const currentId = queue.pop()!;
    const current = matches.find((m) => m.id === currentId);
    if (!current?.nextMatchId) continue;

    const next = matches.find((m) => m.id === current.nextMatchId);
    if (!next) continue;

    if (next.team1Id === prevWinnerId) {
      next.team1Id = null;
      if (next.winnerId === prevWinnerId) {
        next.winnerId = null;
        queue.push(next.id);
      }
    } else if (next.team2Id === prevWinnerId) {
      next.team2Id = null;
      if (next.winnerId === prevWinnerId) {
        next.winnerId = null;
        queue.push(next.id);
      }
    }
  }
}

// ── Sync teams from current registrations ─────────────────────────────────────

/**
 * Update bracket.teams to reflect the current set of registered teams.
 *
 * - Teams already in the bracket: name/memberIds/memberNames are refreshed;
 *   seed and any match assignments are preserved.
 * - Newly registered teams not yet in the bracket: appended at the end with
 *   no seed so the admin can assign them via Edit Matchups.
 * - Teams in the bracket that are no longer registered: left unchanged
 *   (removing them could break existing match references).
 */
export async function syncBracketTeams(
  tournamentId: string,
  currentTeams: BracketTeam[],
  updatedTeams: BracketTeam[],
): Promise<{ added: number; updated: number }> {
  const existingById = new Map(currentTeams.map((t) => [t.id, t]));
  const merged: BracketTeam[] = [];
  let added = 0;
  let updated = 0;

  // Refresh existing teams first (preserve order + seed)
  for (const existing of currentTeams) {
    const fresh = updatedTeams.find((t) => t.id === existing.id);
    if (fresh) {
      merged.push({
        ...fresh,
        seed: existing.seed, // preserve the assigned seed
      });
      if (
        fresh.name !== existing.name ||
        JSON.stringify(fresh.memberIds) !== JSON.stringify(existing.memberIds)
      ) {
        updated++;
      }
    } else {
      // No longer registered — keep as-is to avoid breaking match references
      merged.push(existing);
    }
  }

  // Append newly registered teams that aren't in the bracket yet
  for (const team of updatedTeams) {
    if (!existingById.has(team.id)) {
      merged.push({ ...team, seed: undefined });
      added++;
    }
  }

  if (added === 0 && updated === 0) return { added, updated };

  await setDoc(
    bracketRef(tournamentId),
    { teams: stripUndefined(merged), updatedAt: serverTimestamp() },
    { merge: true },
  );

  return { added, updated };
}

// ── Update first-round matchup assignments ───────────────────────────────────

/**
 * Directly swap which teams face each other in existing first-round matches,
 * without regenerating the bracket structure.
 *
 * If a match's current winner is no longer one of the new participants, that
 * winner is cleared and any downstream results from that match are also cleared.
 */
export async function updateFirstRoundMatchups(
  tournamentId: string,
  currentBracket: TournamentBracket,
  slotUpdates: Array<{
    matchId: string;
    team1Id: string | null;
    team2Id: string | null;
  }>,
): Promise<void> {
  if (slotUpdates.length === 0) return;
  const matches = currentBracket.matches.map((m) => ({ ...m }));

  for (const { matchId, team1Id, team2Id } of slotUpdates) {
    const match = matches.find((m) => m.id === matchId && m.round === 1);
    if (!match) continue;

    const prevWinnerId = match.winnerId;
    const newParticipants = new Set<string | null>([team1Id, team2Id]);

    if (prevWinnerId && !newParticipants.has(prevWinnerId)) {
      // Winner is no longer playing in this match — clear result and downstream
      match.winnerId = null;
      if (match.nextMatchId) {
        clearDownstream(matches, match.id, prevWinnerId);
      }
    }

    match.team1Id = team1Id;
    match.team2Id = team2Id;
  }

  const nextBracket: TournamentBracket = {
    ...currentBracket,
    matches,
  };
  const batch = writeBatch(db);
  batch.set(
    bracketRef(tournamentId),
    { matches, updatedAt: serverTimestamp() },
    { merge: true },
  );
  await syncTournamentBracketWinnerGroups(tournamentId, nextBracket, batch);
  await batch.commit();
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBracket(tournamentId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(bracketRef(tournamentId));
  await syncTournamentBracketWinnerGroups(tournamentId, null, batch);
  await batch.commit();
}
