import { useQuery } from "@tanstack/react-query";
import type { Tournament } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import {
  SeasonAward,
  SeasonAwardType,
  SEASON_AWARD_LABELS,
} from "@/types/seasonAwards";
import { getStatus } from "@/utils/tournamentStatus";

export interface WinningsBreakdownItem {
  tournamentId: string;
  title: string;
  date: Date;
  amount: number; // prize amount for this user in that tournament
  place: number;
  source: "tournament" | "season-award";
  awardType?: SeasonAwardType;
}

export interface UserYearlyWinnings {
  userId: string;
  displayName: string; // best-effort (from winner.displayNames or fallback UID)
  total: number; // sum of amount across tournaments
  tournamentTotal: number;
  seasonAwardsTotal: number;
  breakdown: WinningsBreakdownItem[];
}

function mergeSeasonAwardsIntoWinnings(
  base: UserYearlyWinnings[],
  seasonAwards: SeasonAward[],
): UserYearlyWinnings[] {
  const merged = new Map<string, UserYearlyWinnings>();

  base.forEach((entry) => {
    merged.set(entry.userId, {
      ...entry,
      tournamentTotal: entry.tournamentTotal,
      seasonAwardsTotal: entry.seasonAwardsTotal,
      breakdown: [...entry.breakdown],
    });
  });

  seasonAwards.forEach((award) => {
    const existing = merged.get(award.userId);
    const title = `${SEASON_AWARD_LABELS[award.awardType]} Award`;
    const breakdown: WinningsBreakdownItem = {
      tournamentId: `season-award:${award.id}`,
      title,
      date: award.date,
      amount: award.amount,
      place: 0,
      source: "season-award",
      awardType: award.awardType,
    };

    if (existing) {
      existing.total += award.amount;
      existing.seasonAwardsTotal += award.amount;
      existing.breakdown.push(breakdown);
      return;
    }

    merged.set(award.userId, {
      userId: award.userId,
      displayName: award.userDisplayName || award.userId,
      total: award.amount,
      tournamentTotal: 0,
      seasonAwardsTotal: award.amount,
      breakdown: [breakdown],
    });
  });

  merged.forEach((val) => {
    val.breakdown.sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const A = a.displayName.toLowerCase();
    const B = b.displayName.toLowerCase();
    return A < B ? -1 : A > B ? 1 : 0;
  });
}

// Pure aggregation helper (exported for unit tests)
export function aggregateWinnings(
  tournaments: (Tournament & { firestoreId?: string })[],
): UserYearlyWinnings[] {
  const map = new Map<string, UserYearlyWinnings>();
  for (const t of tournaments) {
    const dateVal = t.date instanceof Date ? t.date : new Date(t.date);
    if (
      t.winnerGroups &&
      Array.isArray(t.winnerGroups) &&
      t.winnerGroups.length > 0
    ) {
      // Prefer new grouped model
      for (const g of t.winnerGroups) {
        for (const w of g.winners || []) {
          const amountPerCompetitor = w.prizeAmount || 0;
          for (let i = 0; i < (w.competitors?.length || 0); i++) {
            const comp = w.competitors![i];
            const uid = comp.userId;
            const displayName = comp.displayName || uid;
            const existing = map.get(uid);
            const item: WinningsBreakdownItem = {
              tournamentId: t.firestoreId || "unknown",
              title: t.title,
              date: dateVal,
              amount: amountPerCompetitor,
              place: w.place,
              source: "tournament",
            };
            if (existing) {
              existing.total += amountPerCompetitor;
              existing.tournamentTotal += amountPerCompetitor;
              existing.breakdown.push(item);
            } else {
              map.set(uid, {
                userId: uid,
                displayName,
                total: amountPerCompetitor,
                tournamentTotal: amountPerCompetitor,
                seasonAwardsTotal: 0,
                breakdown: [item],
              });
            }
          }
        }
      }
      continue;
    }
  }
  // Sort breakdowns chronologically within each user for consistency
  map.forEach((val) => {
    val.breakdown.sort((a, b) => a.date.getTime() - b.date.getTime());
  });
  // Convert to array & sort by total desc then displayName asc (case-insensitive)
  return Array.from(map.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const A = a.displayName.toLowerCase();
    const B = b.displayName.toLowerCase();
    return A < B ? -1 : A > B ? 1 : 0;
  });
}

interface UseYearlyWinningsOptions {
  year: number;
  enabled?: boolean;
}

export function useYearlyWinnings({
  year,
  enabled = true,
}: UseYearlyWinningsOptions) {
  const query = useQuery<UserYearlyWinnings[]>({
    queryKey: ["yearlyWinnings", year],
    enabled,
    queryFn: async () => {
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
      // dynamic import pattern to keep initial bundle lean
      const { db } = await import("@/config/firebase");
      const {
        collection,
        query: q,
        where,
        getDocs,
        orderBy,
      } = await import("firebase/firestore");
      const colRef = collection(db, "tournaments");
      let docsSnap;
      try {
        const tournamentsQuery = q(
          colRef,
          where("date", ">=", start),
          where("date", "<", end),
          orderBy("date", "asc"),
        );
        docsSnap = await getDocs(tournamentsQuery);
      } catch (e) {
        // If index not ready or query fails, fallback to full collection (small data assumption)
        // eslint-disable-next-line no-console
        console.warn(
          "Yearly winnings date-range query failed; falling back to full scan:",
          e,
        );
        docsSnap = await getDocs(colRef);
      }
      const tournaments: (Tournament & { firestoreId?: string })[] = [];
      docsSnap.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (!data) return;
        const rawDate = data.date?.toDate ? data.date.toDate() : data.date;
        const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
        if (dateObj.getFullYear() !== year) return; // guard if fallback path
        const status: TournamentStatus = getStatus({
          status: data.status as TournamentStatus | undefined,
        });
        tournaments.push({
          firestoreId: docSnap.id,
          // required fields with safe defaults to satisfy Tournament
          title: data.title || "(untitled)",
          date: dateObj,
          description: data.description || "",
          players: data.players || 0,
          status,
          prizePool: data.prizePool || 0,
          winnerGroups: data.winnerGroups || [],
          detailsMarkdown: data.detailsMarkdown,
          tee: data.tee,
        } as Tournament & { firestoreId: string });
      });
      const tournamentWinnings = aggregateWinnings(tournaments);
      const { fetchSeasonAwardsByYear } = await import("@/api/seasonAwards");
      const seasonAwards = await fetchSeasonAwardsByYear(year);
      return mergeSeasonAwardsIntoWinnings(tournamentWinnings, seasonAwards);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    winnings: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
