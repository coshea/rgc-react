export interface HistoricalChampionship {
  id: string;
  year: number;
  championshipType:
    | "club-champion"
    | "presidents-cup"
    | "pisano-cup"
    | "team-match-play"
    | "other";

  // Winner info (supports multiple winners for team events)
  winnerNames: string[]; // Array of display names
  winnerIds?: string[]; // Optional Firebase UIDs (null for historical)

  // Runner-up info (supports multiple runners-up for team events)
  runnerUpNames?: string[];
  runnerUpIds?: string[];

  // Tournament reference (optional)
  tournamentId?: string; // Links to tournament doc if it exists

  // Historical metadata
  isHistorical: boolean; // True for backfilled data

  // Standard fields
  createdAt: Date;
  updatedAt: Date;
}

// Union type for displaying both historical and modern championships
export interface UnifiedChampionship {
  id: string;
  year: number;
  championshipType: string;
  winnerNames: string[];
  winnerIds?: string[];
  runnerUpNames?: string[];
  runnerUpIds?: string[];
  isHistorical: boolean;
}

// Championship type display names
export const CHAMPIONSHIP_TYPES = {
  "club-champion": "Club Champion",
  "presidents-cup": "President's Cup",
  "pisano-cup": "The Pisano Cup",
  "team-match-play": "Team Match Play",
  other: "Other",
} as const;

export type ChampionshipType = keyof typeof CHAMPIONSHIP_TYPES;
