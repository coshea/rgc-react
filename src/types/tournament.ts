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
  completed: boolean;
  canceled: boolean;
  // Whether registration is open for this tournament
  registrationOpen?: boolean;
  icon?: string;
  href?: string;
  prizePool: number;
  winners?: import("./winner").Winner[];
  /** Phase 1: New grouped winners model (to be used in Phase 2 UI) */
  winnerGroups?: import("./winner").WinnerGroup[];
  // Tee selection for the tournament round
  tee?: "Blue" | "White" | "Gold" | "Red" | "Mixed";
}

export enum TournamentStatus {
  Upcoming = "upcoming",
  Open = "open",
  InProgress = "in-progress",
  Completed = "completed",
  Canceled = "canceled",
}
