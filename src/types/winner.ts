export interface Winner {
  place: number; // 1 for 1st place, 2 for 2nd place, etc.
  userIds: string[]; // Array of user IDs (single item for individual, multiple for team)
  displayNames: string[]; // Array of display names
  prizeAmount: number; // Prize amount per person
  score?: string; // optional score text
}
