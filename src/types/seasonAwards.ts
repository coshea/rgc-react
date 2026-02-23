export enum SeasonAwardType {
  HoleInOne = "hole_in_one",
}

export const SEASON_AWARD_LABELS: Record<SeasonAwardType, string> = {
  [SeasonAwardType.HoleInOne]: "Hole in One",
};

export const SEASON_AWARD_DEFAULT_AMOUNTS: Record<SeasonAwardType, number> = {
  [SeasonAwardType.HoleInOne]: 50,
};

export interface SeasonAward {
  id: string;
  userId: string;
  userDisplayName: string;
  awardType: SeasonAwardType;
  amount: number;
  date: Date;
  seasonYear: number;
  tournamentId?: string;
  tournamentTitle?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpsertSeasonAwardInput {
  id?: string;
  userId: string;
  userDisplayName: string;
  awardType: SeasonAwardType;
  amount: number;
  date: Date;
  seasonYear: number;
  tournamentId?: string;
  tournamentTitle?: string;
}
