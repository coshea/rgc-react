/**
 * Firestore helpers for tournament brackets.
 * Collection: brackets/{tournamentId}
 */

import { db } from "@/config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type FirestoreError,
} from "firebase/firestore";
import type { TournamentBracket, BracketMatch } from "@/types/bracket";

const bracketRef = (tournamentId: string) => doc(db, "brackets", tournamentId);

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
  await setDoc(bracketRef(bracket.tournamentId), {
    ...stripUndefined(bracket),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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

  await setDoc(
    bracketRef(tournamentId),
    { matches, updatedAt: serverTimestamp() },
    { merge: true },
  );
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

  await setDoc(
    bracketRef(tournamentId),
    { matches, updatedAt: serverTimestamp() },
    { merge: true },
  );
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

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteBracket(tournamentId: string): Promise<void> {
  await deleteDoc(bracketRef(tournamentId));
}
