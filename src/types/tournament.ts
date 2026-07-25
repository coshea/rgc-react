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
   * Registration window boundaries stored in UTC. Clients should localize when displaying.
   */
  registrationStart?: Date;
  registrationEnd?: Date;
  /**
   * When false, suppress the automatic push notification that is sent when registration opens.
   * Defaults to true when omitted.
   */
  registrationOpeningNotificationEnabled?: boolean;
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
  // True when the event uses assigned tee times.
  assignedTeeTimes?: boolean;
  // Optional cap on number of registered teams. Sign-ups are not blocked; teams beyond this count are treated as waitlisted in the UI.
  maxTeams?: number;
  // Link to previous year's tournament (Firestore ID) to display defending champion
  previousTournamentId?: string;
  // Weather data for the tournament day
  weather?: TournamentWeather;
  // When true, players may select gold (senior) tees during registration
  goldTeesEnabled?: boolean;
  // When true, the bracket is visible to all users on the tournament detail page.
  // Admins can always see it. Defaults to false (unpublished).
  bracketPublished?: boolean;
  /**
   * When true, suppress bracket matchup email notifications for this tournament.
   * Defaults to false (emails enabled) when omitted.
   */
  bracketNotificationsDisabled?: boolean;
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
  InProgress = "In Progress",
  Completed = "Completed",
  Canceled = "Canceled",
}
