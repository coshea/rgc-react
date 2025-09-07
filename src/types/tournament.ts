export interface Tournament {
  id: number;
  title: string;
  date: Date;
  description: string;
  players: number;
  completed: boolean;
  canceled: boolean;
  icon?: string;
  href?: string;
  prizePool: number;
  winners?: import("./winner").Winner[];
}
