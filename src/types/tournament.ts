export interface Tournament {
  // Optional Firestore document id for this tournament (useful for updates)
  firestoreId?: string;
  title: string;
  date: Date;
  description: string;
  // Extended markdown capable details (optional rich content)
  detailsMarkdown?: string;
  players: number;
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
