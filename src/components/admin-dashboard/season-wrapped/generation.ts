import {
  SEASON_WRAPPED_GENERATE_TIMEOUT_SECONDS,
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

/** Longer than the generate callable's timeout, so a pending doc this old belongs to a run that died. */
export const STALE_PENDING_MS =
  (SEASON_WRAPPED_GENERATE_TIMEOUT_SECONDS + 5 * 60) * 1000;

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

/**
 * Progress of what's running now: members finished out of everyone in the
 * active runs. A run is active while any of its members is pending, and the
 * total keeps the members it already finished, even ones this browser didn't
 * request (members with no story yet in a full run, or after a reload), so
 * the first number climbs to a fixed total. Skipped members aren't counted.
 */
export function generationProgress(
  states: ReadonlyMap<string, GenerationRowState>,
  requests: GenerationRequests,
  docs: ReadonlyMap<string, SeasonWrappedGeneration>,
): { done: number; total: number } | null {
  const { PENDING, SKIPPED } = SEASON_WRAPPED_GENERATION_STATUS;
  const isPending = (uid: string) => states.get(uid) === GENERATION_ROW_STATE.PENDING;
  // False while a requested member's doc is still the one from before the request.
  const isCurrent = (doc: SeasonWrappedGeneration) => requests.get(doc.uid)?.prev !== doc.updatedAt;

  // Runs with someone still pending (a stale pending doc reads as failed, so its run isn't active).
  const activeRuns = new Set<string>();
  for (const doc of docs.values()) {
    if (doc.status === PENDING && isCurrent(doc) && isPending(doc.uid)) activeRuns.add(doc.runId);
  }

  const members = new Set(requests.keys());
  for (const doc of docs.values()) if (isCurrent(doc) && activeRuns.has(doc.runId)) members.add(doc.uid);

  const counted = [...members].filter((uid) => {
    const doc = docs.get(uid);
    return !(doc && isCurrent(doc) && doc.status === SKIPPED);
  });
  const pending = counted.filter(isPending).length;
  if (pending === 0) return null;
  return { done: counted.length - pending, total: counted.length };
}
