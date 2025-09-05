export interface TournamentItem {
  id: number;
  title: string;
  date: Date;
  description: string;
  players: number;
  completed: boolean;
  icon?: string;
  href?: string;
  prizePool: number;
}
