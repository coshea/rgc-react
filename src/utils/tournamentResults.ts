import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import {
  computeDisplayPlaces,
  computeTotalPayout,
  sortGroups,
  sortPlaces,
} from "@/utils/winners";

export interface ResultEntry {
  key: string;
  /** "1", "T3" or, for closest-to-pin, "No. 3". */
  placeLabel: string;
  isFirst: boolean;
  userIds: string[];
  fallbackNames: string[];
  score?: string;
  /** Prize per player. */
  prize: number;
  teamSize: number;
}

export interface ResultSection {
  id: string;
  label: string;
  isCloseToPin: boolean;
  entries: ResultEntry[];
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Under-par scores are written with a leading minus (hyphen or true minus). */
export function isUnderPar(score?: string): boolean {
  return !!score && /^[-−]/.test(score.trim());
}

/** Tournament dates are date-only, stored as midnight UTC. */
export function formatEventDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

export function getPaidTotal(groups: WinnerGroup[] = []): number {
  return computeTotalPayout(groups);
}

export function getPaidPlayerCount(groups: WinnerGroup[] = []): number {
  const ids = new Set<string>();
  for (const g of groups) {
    for (const w of g.winners || []) {
      if ((w.prizeAmount ?? 0) <= 0) continue;
      for (const c of w.competitors || []) ids.add(c.userId);
    }
  }
  return ids.size;
}

/** The first-place entry of the first group that has one, or undefined. */
export function getChampion(
  groups: WinnerGroup[] = [],
): WinnerPlace | undefined {
  for (const g of sortGroups(groups)) {
    if (g.type === "closestToPin") continue;
    const first = sortPlaces(g.winners || []).find(
      (w) => w.place === 1 && (w.competitors?.length ?? 0) > 0,
    );
    if (first) return first;
  }
  return undefined;
}

/** Sections in the club's order, each with places in finishing order. */
export function buildSections(groups: WinnerGroup[] = []): ResultSection[] {
  return sortGroups(groups)
    .filter((g) => (g.winners?.length ?? 0) > 0)
    .map((g) => {
      const isCloseToPin = g.type === "closestToPin";
      const places = sortPlaces(g.winners);
      const display = computeDisplayPlaces(places);
      const entries = places.map((w, i): ResultEntry => {
        const tied = places.filter((p) => p.place === w.place).length > 1;
        const rank = display[i].displayPlace;
        const competitors = w.competitors || [];
        return {
          key: w.id || `${g.id}-${w.place}-${i}`,
          placeLabel: isCloseToPin
            ? `No. ${w.holeNumber ?? w.place}`
            : `${tied ? "T" : ""}${rank}`,
          isFirst: !isCloseToPin && rank === 1,
          userIds: competitors.map((c) => c.userId),
          fallbackNames: competitors.map((c) => c.displayName || c.userId),
          score: w.score,
          prize: w.prizeAmount ?? 0,
          teamSize: competitors.length,
        };
      });
      return { id: g.id, label: g.label, isCloseToPin, entries };
    });
}
