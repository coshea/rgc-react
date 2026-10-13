import type { UserYearlyWinnings } from "@/hooks/useYearlyWinnings";

export interface StandingsRow extends UserYearlyWinnings {
  /** Shared by players with equal earnings (1, 2, 4, 4, 6…). */
  rank: number;
  /** "4", or "T4" when tied. */
  rankLabel: string;
  /** Distinct tournaments with a payout. */
  events: number;
  /** First-place payouts. */
  wins: number;
  awards: number;
}

export interface SeasonSummary {
  tournamentsPaid: number;
  awardsPaid: number;
  players: number;
  tournaments: number;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Rows in earnings order, with golf-style shared ranks for ties. */
export function rankStandings(winnings: UserYearlyWinnings[]): StandingsRow[] {
  const sorted = [...winnings].sort((a, b) => b.total - a.total);
  return sorted.map((w) => {
    const rank = 1 + sorted.filter((o) => o.total > w.total).length;
    const tied = sorted.filter((o) => o.total === w.total).length > 1;
    const tournamentItems = (w.breakdown || []).filter(
      (b) => b.source !== "season-award",
    );
    const awards = (w.breakdown || [])
      .filter((b) => b.source === "season-award")
      .reduce((sum, b) => sum + (b.amount || 0), 0);
    return {
      ...w,
      rank,
      rankLabel: `${tied ? "T" : ""}${rank}`,
      events: new Set(tournamentItems.map((b) => b.tournamentId)).size,
      wins: tournamentItems.filter((b) => b.place === 1).length,
      awards,
    };
  });
}

export function summarizeSeason(rows: StandingsRow[]): SeasonSummary {
  const tournamentIds = new Set<string>();
  let tournamentsPaid = 0;
  let awardsPaid = 0;
  for (const r of rows) {
    for (const b of r.breakdown || []) {
      if (b.source === "season-award") {
        awardsPaid += b.amount || 0;
      } else {
        tournamentsPaid += b.amount || 0;
        tournamentIds.add(b.tournamentId);
      }
    }
  }
  return {
    tournamentsPaid,
    awardsPaid,
    players: rows.length,
    tournaments: tournamentIds.size,
  };
}
