export interface Tournament {
  // Optional Firestore document id for this tournament (useful for updates)
  firestoreId?: string;
  title: string;
  date: Date;
  description: string;
  players: number;
  completed: boolean;
  canceled: boolean;
  // Whether registration is open for this tournament
  registrationOpen?: boolean;
  icon?: string;
  href?: string;
  prizePool: number;
  winners?: import("./winner").Winner[];
  // Tee selection for the tournament round
  tee?: "Blue" | "White" | "Gold" | "Red" | "Mixed";
}
