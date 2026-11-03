import {
  SEASON_WRAPPED_GENERATION_STATUS,
  type SeasonWrappedGeneration,
} from "@@/seasonWrapped/types";

/** What a row in the admin list shows about generating. */
export const GENERATION_ROW_STATE = {
  PENDING: "pending",
  SKIPPED: "skipped",
  FAILED: "failed",
} as const;

export type GenerationRowState =
  (typeof GENERATION_ROW_STATE)[keyof typeof GENERATION_ROW_STATE];

/** Longer than the callable's 540s timeout, so a pending doc this old belongs to a run that died. */
export const STALE_PENDING_MS = 10 * 60 * 1000;

/**
 * Members this browser just asked to generate. The value is the `updatedAt`
 * of their status doc at the time (null if none), so the server's first write
 * for the new run can be told apart from the last run's without comparing
 * clocks. `run` lets overlapping runs clear only their own entries.
 */
export type GenerationRequests = ReadonlyMap<string, { prev: string | null; run: number }>;

/**
 * The state of each member that has one (members with none are idle). A
 * requested member is pending until the server writes for the new run; after
 * that the server's doc decides. Skipped members are shown only while
 * requested, and a pending doc left by a dead run counts as failed.
 */
export function generationRowStates(
  docs: ReadonlyMap<string, SeasonWrappedGeneration>,
  requests: GenerationRequests,
  now: number,
): Map<string, GenerationRowState> {
  const { PENDING, SKIPPED, FAILED } = SEASON_WRAPPED_GENERATION_STATUS;
  const states = new Map<string, GenerationRowState>();

  for (const uid of new Set([...requests.keys(), ...docs.keys()])) {
    const request = requests.get(uid);
    const doc = docs.get(uid);
    if (request && (!doc || doc.updatedAt === request.prev)) {
      states.set(uid, GENERATION_ROW_STATE.PENDING);
    } else if (doc?.status === PENDING) {
      const stale = now - Date.parse(doc.updatedAt) > STALE_PENDING_MS;
      states.set(uid, stale ? GENERATION_ROW_STATE.FAILED : GENERATION_ROW_STATE.PENDING);
    } else if (doc?.status === FAILED) {
      states.set(uid, GENERATION_ROW_STATE.FAILED);
    } else if (doc?.status === SKIPPED && request) {
      states.set(uid, GENERATION_ROW_STATE.SKIPPED);
    }
  }
  return states;
}

/** Progress of what's running now: members done out of everyone in flight or just finished. */
export function generationProgress(
  states: ReadonlyMap<string, GenerationRowState>,
  requests: GenerationRequests,
): { done: number; total: number } | null {
  const inFlight = new Set(requests.keys());
  for (const [uid, state] of states) if (state === GENERATION_ROW_STATE.PENDING) inFlight.add(uid);
  const pending = [...inFlight].filter((uid) => states.get(uid) === GENERATION_ROW_STATE.PENDING).length;
  if (pending === 0) return null;
  return { done: inFlight.size - pending, total: inFlight.size };
}
