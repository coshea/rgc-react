import type { WinnerGroup, WinnerPlace } from "@/types/winner";

/**
 * Helpers for working with grouped winners.
 * Phase 1: pure utilities with no UI coupling.
 */

/**
 * Create a new empty WinnerGroup with sensible defaults.
 */
export function makeWinnerGroup(params: {
  id: string;
  label: string;
  type: WinnerGroup["type"]; // 'overall' | 'day' | 'flight' | 'custom'
  order: number;
  dayIndex?: number;
}): WinnerGroup {
  return {
    id: params.id,
    label: params.label.trim(),
    type: params.type,
    order: params.order,
    dayIndex: params.dayIndex,
    winners: [],
  };
}

/** Sort groups by order asc. */
export function sortGroups(groups: WinnerGroup[]): WinnerGroup[] {
  return [...groups].sort((a, b) => a.order - b.order);
}

/** Sort places by place asc. */
export function sortPlaces(winners: WinnerPlace[]): WinnerPlace[] {
  return [...winners].sort((a, b) => a.place - b.place);
}

/**
 * Given a list of WinnerPlace already sorted by place, compute display ranks
 * with tie handling. If two entries share the same place (tie), they get the
 * same display rank and the next distinct spot skips accordingly.
 * Example: [1,2,2,3] -> display ranks [1,2,2,4].
 */
export function computeDisplayPlaces(
  winners: WinnerPlace[]
): Array<{ place: number; displayPlace: number }> {
  const out: Array<{ place: number; displayPlace: number }> = [];
  const sorted = sortPlaces(winners);
  let nextRank = 1;
  for (let i = 0; i < sorted.length; ) {
    const currentPlace = sorted[i].place;
    // group all ties for current place
    const group: number[] = [];
    let j = i;
    while (j < sorted.length && sorted[j].place === currentPlace) {
      group.push(sorted[j].place);
      j++;
    }
    // assign same display rank to all in the tie group
    for (let k = i; k < j; k++) {
      out.push({ place: sorted[k].place, displayPlace: nextRank });
    }
    // advance rank by size of tie group
    nextRank += group.length;
    i = j;
  }
  return out;
}

/**
 * Compute total payout assuming prizeAmount is per competitor.
 * If you shift semantics to total-per-place, update this accordingly.
 */
export function computeTotalPayout(groups: WinnerGroup[]): number {
  let sum = 0;
  for (const g of groups) {
    for (const w of g.winners) {
      const p = w.prizeAmount ?? 0;
      sum += p * (w.competitors?.length || 0);
    }
  }
  return sum;
}

/**
 * Ensure no duplicate place numbers within a group.
 */
export function hasDuplicatePlaces(group: WinnerGroup): boolean {
  const seen = new Set<number>();
  for (const w of group.winners) {
    if (seen.has(w.place)) return true;
    seen.add(w.place);
  }
  return false;
}
