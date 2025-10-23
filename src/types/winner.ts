/**
 * Winner grouping model for flexible tournament results
 * Supports: overall winners, daily results, flights, closest-to-pin, and custom categories
 */

export type WinnerGroupType =
  | "overall"
  | "day"
  | "flight"
  | "closestToPin"
  | "custom";

export interface Competitor {
  userId: string;
  displayName: string;
}

/** Place entry within a group */
export interface WinnerPlace {
  /** Unique identifier for the place entry. Optional for backward compatibility with existing data */
  id?: string;
  place: number; // 1 for 1st place, 2 for 2nd place, etc.
  competitors: Competitor[]; // one per person; teams have >= 2
  prizeAmount?: number; // prize per competitor (preferred) or total if you choose that semantics later
  score?: string; // optional score text
}

export interface WinnerGroup {
  id: string; // stable id for referencing and sorting
  label: string; // e.g. "Day 1", "Day 2", "Overall", "Skins", "Closest to Pin - Hole 3"
  type: WinnerGroupType;
  order: number; // display order among groups
  dayIndex?: number; // only when type === 'day'
  holeNumber?: number; // only when type === 'closestToPin' (3, 5, 12, or 17)
  winners: WinnerPlace[]; // places within this group
}
