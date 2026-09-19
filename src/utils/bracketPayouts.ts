import type { TournamentBracket } from "@/types/bracket";
import type { BracketRoundPayout } from "@/types/tournament";
import type { Competitor, WinnerGroup } from "@/types/winner";

const BRACKET_GROUP_ID_PREFIX = "bracket-round:";
const BRACKET_STANDINGS_GROUP_ID = `${BRACKET_GROUP_ID_PREFIX}standings`;

function roundSortAsc(a: { round: number }, b: { round: number }) {
  return a.round - b.round;
}

export function makeBracketRoundGroupId(round: number): string {
  return `${BRACKET_GROUP_ID_PREFIX}${round}`;
}

export function isBracketRoundGroup(group: WinnerGroup): boolean {
  return group.type === "bracketRound";
}

export function isAutomatedBracketWinnerGroup(group: WinnerGroup): boolean {
  return (
    group.id.startsWith(BRACKET_GROUP_ID_PREFIX) ||
    group.type === "bracketRound"
  );
}

export function normalizeBracketRoundPayouts(
  payouts: BracketRoundPayout[] | undefined,
): BracketRoundPayout[] {
  if (!payouts?.length) return [];

  const deduped = new Map<number, BracketRoundPayout>();
  for (const payout of payouts) {
    if (!Number.isFinite(payout.round) || payout.round < 1) continue;
    const amount = Number.isFinite(payout.amount) ? payout.amount : 0;
    const runnerUpAmount =
      Number.isFinite(payout.runnerUpAmount) && (payout.runnerUpAmount ?? 0) > 0
        ? Number(payout.runnerUpAmount)
        : undefined;
    deduped.set(Math.trunc(payout.round), {
      round: Math.trunc(payout.round),
      amount: Math.max(0, amount),
      ...(runnerUpAmount !== undefined ? { runnerUpAmount } : {}),
    });
  }

  const normalized = Array.from(deduped.values()).sort(roundSortAsc);
  const finalRound = normalized[normalized.length - 1]?.round;

  return normalized.map((payout) => ({
    round: payout.round,
    amount: payout.amount,
    ...(payout.round === finalRound && payout.runnerUpAmount !== undefined
      ? { runnerUpAmount: payout.runnerUpAmount }
      : {}),
  }));
}

function buildCompetitors(
  memberIds: string[],
  memberNames?: string[],
): Competitor[] {
  return memberIds.map((userId, index) => ({
    userId,
    displayName: memberNames?.[index] || userId,
  }));
}

function buildRoundLabel(round: number, totalRounds: number): string {
  if (round >= totalRounds) return "Final Winners";
  if (round === totalRounds - 1) return "Semi Final Winners";
  if (round === totalRounds - 2) return "Quarter Final Winners";
  return `Round ${round} Winners`;
}

export function formatBracketRoundLabel(
  round: number,
  totalRounds?: number,
): string {
  if (typeof totalRounds === "number" && totalRounds >= 1) {
    return buildRoundLabel(round, totalRounds);
  }
  return `Round ${round}`;
}

function placementForEliminationRound(
  totalRounds: number,
  eliminatedRound: number,
): number {
  return Math.pow(2, totalRounds - eliminatedRound) + 1;
}

interface TeamStanding {
  teamId: string;
  competitors: Competitor[];
  teamName: string;
  totalPrize: number;
  placement: number;
}

export function buildBracketWinnerGroups(
  bracket: TournamentBracket | null | undefined,
  payouts: BracketRoundPayout[] | undefined,
): WinnerGroup[] {
  if (!bracket) return [];

  const normalizedPayouts = normalizeBracketRoundPayouts(payouts);
  if (normalizedPayouts.length === 0) return [];

  const totalRounds = Math.max(
    1,
    bracket.matches.reduce((max, match) => Math.max(max, match.round), 1),
  );

  const standings = new Map<
    string,
    {
      competitors: Competitor[];
      teamName: string;
      totalPrize: number;
      eliminatedRound?: number;
      alive: boolean;
    }
  >();

  for (const team of bracket.teams) {
    standings.set(team.id, {
      competitors: buildCompetitors(team.memberIds, team.memberNames),
      teamName: team.name,
      totalPrize: 0,
      alive: true,
    });
  }

  normalizedPayouts.forEach((payout) => {
    const roundMatches = bracket.matches.filter(
      (match) => match.round === payout.round,
    );

    roundMatches.forEach((match) => {
      if (!match.winnerId) return;

      const winnerStanding = standings.get(match.winnerId);
      if (winnerStanding && payout.amount > 0) {
        winnerStanding.totalPrize += payout.amount;
      }

      const loserId =
        match.team1Id && match.team1Id !== match.winnerId
          ? match.team1Id
          : match.team2Id && match.team2Id !== match.winnerId
            ? match.team2Id
            : null;

      if (loserId) {
        const loserStanding = standings.get(loserId);
        if (loserStanding) {
          loserStanding.alive = false;
          loserStanding.eliminatedRound = match.round;
        }
      }
    });
  });

  const finalMatch = bracket.matches.find(
    (match) => match.nextMatchId === null,
  );
  const finalPayout = normalizedPayouts.find(
    (payout) => payout.round === totalRounds,
  );
  const championId = finalMatch?.winnerId ?? undefined;
  const runnerUpId =
    finalMatch?.winnerId && finalMatch.team1Id && finalMatch.team2Id
      ? finalMatch.team1Id === finalMatch.winnerId
        ? finalMatch.team2Id
        : finalMatch.team1Id
      : undefined;

  if (runnerUpId && (finalPayout?.runnerUpAmount ?? 0) > 0) {
    const runnerUpStanding = standings.get(runnerUpId);
    if (runnerUpStanding) {
      runnerUpStanding.totalPrize += finalPayout!.runnerUpAmount!;
    }
  }

  const winnerPlaces: TeamStanding[] = [];
  standings.forEach((standing, teamId) => {
    const placement =
      championId === teamId
        ? 1
        : runnerUpId === teamId
          ? 2
          : standing.eliminatedRound !== undefined
            ? placementForEliminationRound(
                totalRounds,
                standing.eliminatedRound,
              )
            : 1;

    winnerPlaces.push({
      teamId,
      competitors: standing.competitors,
      teamName: standing.teamName,
      totalPrize: standing.totalPrize,
      placement,
    });
  });

  winnerPlaces.sort((a, b) => {
    if (a.placement !== b.placement) return a.placement - b.placement;
    if (b.totalPrize !== a.totalPrize) return b.totalPrize - a.totalPrize;
    return a.teamName.localeCompare(b.teamName);
  });

  const paidWinnerPlaces = winnerPlaces.filter(
    (standing) => standing.totalPrize > 0,
  );

  if (paidWinnerPlaces.length === 0) return [];

  return [
    {
      id: BRACKET_STANDINGS_GROUP_ID,
      label: "Bracket Standings",
      type: "overall",
      order: 0,
      winners: paidWinnerPlaces.map((standing) => ({
        id: `${standing.teamId}:standings`,
        place: standing.placement,
        competitors: standing.competitors,
        prizeAmount: standing.totalPrize,
      })),
    },
  ];
}

export function mergeBracketWinnerGroups(
  existingGroups: WinnerGroup[] | undefined,
  generatedGroups: WinnerGroup[],
): WinnerGroup[] {
  const preservedGroups = (existingGroups ?? []).filter(
    (group) => !isAutomatedBracketWinnerGroup(group),
  );

  return [...preservedGroups, ...generatedGroups].map((group, index) => ({
    ...group,
    order: index,
  }));
}
