import type { TeeName } from "@/utils/teeStyles";
export interface Tournament {
  // Optional Firestore document id for this tournament (useful for updates)
  firestoreId?: string;
  title: string;
  date: Date;
  description: string;
  // Extended markdown capable details (optional rich content)
  detailsMarkdown?: string;
  players: number;
  /**
   * Unified status for the tournament. New code should prefer this over the legacy boolean flags.
   * For backward compatibility, the boolean flags are still present and kept in sync client-side.
   */
  status?: TournamentStatus;
  icon?: string;
  href?: string;
  prizePool: number;
  winnerGroups?: import("./winner").WinnerGroup[];
  // Tee selection for the tournament round
  tee?: TeeName;
  // Link to previous year's tournament (Firestore ID) to display defending champion
  previousTournamentId?: string;
  // Weather data for the tournament day
  weather?: TournamentWeather;
}

export interface TournamentWeather {
  temperature: number; // Fahrenheit
  condition: string; // e.g., "Partly Cloudy", "Sunny", "Rainy"
  windSpeed: number; // mph
  precipitation: number; // inches
  humidity: number; // percentage
}

export enum TournamentStatus {
  Upcoming = "Upcoming",
  Open = "Registration Open",
  InProgress = "In Progress",
  Completed = "Completed",
  Canceled = "Canceled",
}
