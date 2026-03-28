/**
 * Tournament bracket types.
 * Brackets are stored in Firestore at brackets/{tournamentId}.
 */

export interface BracketTeam {
  /** Registration document ID used as the stable team identifier */
  id: string;
  /** Display name for the team (captain / representative name) */
  name: string;
  /** Firebase Auth UIDs for all players on the team */
  memberIds: string[];
  /** Display names for all players on the team (same order as memberIds) */
  memberNames?: string[];
  /** 1 = top seed (gets first bye priority); undefined = unseeded */
  seed?: number;
}

export interface BracketMatch {
  id: string;
  /** 1-indexed round number (1 = first round, numRounds = final) */
  round: number;
  /** 0-indexed position within the round */
  position: number;
  /** Match ID that the winner advances to; null for the final */
  nextMatchId: string | null;
  /** null = TBD (winner from previous round has not been determined) or bye slot in round 1 */
  team1Id: string | null;
  team2Id: string | null;
  /** Registration ID of the winning team; null = not yet decided */
  winnerId: string | null;
}

export interface TournamentBracket {
  tournamentId: string;
  format: "single_elimination";
  /** Always a power of 2 */
  size: number;
  teams: BracketTeam[];
  matches: BracketMatch[];
}
