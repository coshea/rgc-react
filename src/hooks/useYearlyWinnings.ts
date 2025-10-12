import { useQuery } from "@tanstack/react-query";
import type { Tournament } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import { getStatus } from "@/utils/tournamentStatus";
import type { Winner } from "@/types/winner";

export interface WinningsBreakdownItem {
  tournamentId: string;
  title: string;
  date: Date;
  amount: number; // prize amount for this user in that tournament
  place: number;
}

export interface UserYearlyWinnings {
  userId: string;
  displayName: string; // best-effort (from winner.displayNames or fallback UID)
  total: number; // sum of amount across tournaments
  breakdown: WinningsBreakdownItem[];
}

// Pure aggregation helper (exported for unit tests)
export function aggregateWinnings(
  tournaments: (Tournament & { firestoreId?: string })[]
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
            };
            if (existing) {
              existing.total += amountPerCompetitor;
              existing.breakdown.push(item);
            } else {
              map.set(uid, {
                userId: uid,
                displayName,
                total: amountPerCompetitor,
                breakdown: [item],
              });
            }
          }
        }
      }
      continue;
    }
    // Fallback to legacy winners array
    if (!t.winners || !Array.isArray(t.winners)) continue;
    (t.winners as Winner[]).forEach((w) => {
      if (!w || !w.userIds) return;
      w.userIds.forEach((uid, idx) => {
        const displayName =
          (w.displayNames && w.displayNames[idx]) ||
          (w.displayNames && w.displayNames[0]) ||
          uid;
        const existing = map.get(uid);
        const amount = w.prizeAmount || 0;
        const item: WinningsBreakdownItem = {
          tournamentId: t.firestoreId || "unknown",
          title: t.title,
          date: dateVal,
          amount,
          place: w.place,
        };
        if (existing) {
          existing.total += amount;
          existing.breakdown.push(item);
        } else {
          map.set(uid, {
            userId: uid,
            displayName,
            total: amount,
            breakdown: [item],
          });
        }
      });
    });
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
          orderBy("date", "asc")
        );
        docsSnap = await getDocs(tournamentsQuery);
      } catch (e) {
        // If index not ready or query fails, fallback to full collection (small data assumption)
        // eslint-disable-next-line no-console
        console.warn(
          "Yearly winnings date-range query failed; falling back to full scan:",
          e
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
          winners: data.winners || [],
          winnerGroups: data.winnerGroups || [],
          detailsMarkdown: data.detailsMarkdown,
          tee: data.tee,
        } as Tournament & { firestoreId: string });
      });
      return aggregateWinnings(tournaments);
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
