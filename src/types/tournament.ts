export interface TournamentItem {
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
}
