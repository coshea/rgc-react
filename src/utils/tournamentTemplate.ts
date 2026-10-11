import type { Tournament } from "@/types/tournament";

/**
 * Fields copied when creating a new tournament from a previous one.
 * Dates, registration windows, winners and weather are specific to each
 * event, so they are left out.
 */
export function buildTournamentTemplate(
  source: Tournament,
): Partial<Tournament> {
  return {
    title: source.title,
    description: source.description,
    detailsMarkdown: source.detailsMarkdown,
    players: source.players,
    prizePool: source.prizePool,
    bracketRoundPayouts: source.bracketRoundPayouts?.map((payout) => ({
      ...payout,
    })),
    tee: source.tee,
    assignedTeeTimes: source.assignedTeeTimes,
  };
}
