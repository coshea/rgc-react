import { useQuery } from "@tanstack/react-query";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { fetchUserChampionships } from "@/api/championships";
import { SEASON_AWARD_LABELS } from "@/types/seasonAwards";
import type { Tournament } from "@/types/tournament";

export interface UserTournamentWin {
  id: string;
  tournamentName: string;
  year: number;
  championshipType?: string;
  isMajor: boolean;
  prize?: number;
  date: string;
  placement: "champion" | "runner-up" | "winner";
  position?: number;
  source: "championship" | "tournament";
}

export interface UserChampionship {
  id: string;
  tournamentName: string;
  year: number;
  championshipType: string;
  placement: "champion" | "runner-up";
  date: string;
}

export interface UserWinnings {
  yearly: Array<{
    year: number;
    amount: number;
  }>;
  lifetime: number;
}

export interface UserSeasonAward {
  id: string;
  year: number;
  amount: number;
}

/**
 * Hook to fetch championships won by a specific user
 * Searches through championships to find wins where the user was either champion or runner-up
 */
export function useUserChampionships(userId: string | undefined) {
  return useQuery({
    queryKey: ["userChampionshipsForTournaments", userId],
    queryFn: async (): Promise<UserChampionship[]> => {
      if (!userId) return [];

      // Use the updated fetchUserChampionships function that works correctly
      const championships = await fetchUserChampionships(userId);
      const userChampionships: UserChampionship[] = [];

      championships.forEach((championship) => {
        // Check if user is a champion
        if (championship.winnerIds && championship.winnerIds.includes(userId)) {
          userChampionships.push({
            id: `${championship.id}-champion`,
            tournamentName: championship.championshipType,
            year: championship.year,
            championshipType: championship.championshipType,
            placement: "champion",
            date: `${championship.year}-06-15`, // Default date, TODO: use real tournament dates
          });
        }

        // Check if user is a runner-up
        if (
          championship.runnerUpIds &&
          championship.runnerUpIds.includes(userId)
        ) {
          userChampionships.push({
            id: `${championship.id}-runnerup`,
            tournamentName: championship.championshipType,
            year: championship.year,
            championshipType: championship.championshipType,
            placement: "runner-up",
            date: `${championship.year}-06-15`, // Default date, TODO: use real tournament dates
          });
        }
      });

      return userChampionships;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch tournament wins by a specific user from regular tournaments
 * Similar to how the money list page aggregates tournament data
 */
export function useUserTournamentWins(userId: string | undefined) {
  return useQuery({
    queryKey: ["userTournamentWins", userId],
    queryFn: async (): Promise<UserTournamentWin[]> => {
      if (!userId) return [];

      const tournamentsRef = collection(db, "tournaments");
      const q = query(tournamentsRef, orderBy("date", "desc"));
      const snapshot = await getDocs(q);

      const userWins: UserTournamentWin[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const rawDate = data.date?.toDate ? data.date.toDate() : data.date;
        const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
        const year = dateObj.getFullYear();

        const tournament = {
          ...data,
          id: doc.id,
          firestoreId: doc.id,
          date: dateObj,
        } as unknown as Tournament & { firestoreId: string };

        const groups = (data as { winnerGroups?: unknown }).winnerGroups as
          | Array<{
              winners?: Array<{
                place: number;
                prizeAmount?: number;
                competitors?: Array<{ userId: string; displayName?: string }>;
              }>;
            }>
          | undefined;

        if (groups && Array.isArray(groups) && groups.length > 0) {
          groups.forEach((g, gIdx) => {
            (g.winners || []).forEach((w, wIdx) => {
              (w.competitors || []).forEach((c, cIdx) => {
                if (c.userId === userId) {
                  const prize = w.prizeAmount || 0;
                  const position = w.place || 1;
                  userWins.push({
                    id: `${doc.id}-g${gIdx}-w${wIdx}-c${cIdx}`,
                    tournamentName: tournament.title || "Unknown Tournament",
                    year,
                    isMajor: false,
                    prize,
                    date: tournament.date.toISOString(),
                    placement: position === 1 ? "winner" : "winner",
                    position,
                    source: "tournament",
                  });
                }
              });
            });
          });
          return; // prefer groups, skip legacy
        }
      });

      return userWins;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch winnings data for a specific user
 * Calculates winnings from actual tournament and championship data
 */
export function useUserWinnings(userId: string | undefined) {
  const { data: tournamentWins = [], isLoading: tournamentWinsLoading } =
    useUserTournamentWins(userId);
  const { data: championships = [], isLoading: championshipsLoading } =
    useUserChampionships(userId);
  const { data: seasonAwards = [], isLoading: seasonAwardsLoading } =
    useUserSeasonAwards(userId);

  return useQuery({
    queryKey: [
      "userWinnings",
      userId,
      tournamentWins.length,
      championships.length,
      seasonAwards.length,
    ],
    queryFn: async (): Promise<UserWinnings> => {
      if (!userId) {
        return { yearly: [], lifetime: 0 };
      }

      // Combine all winnings from tournaments and championships
      const allWinnings: Array<{ year: number; amount: number }> = [];

      // Add tournament winnings
      tournamentWins.forEach((win) => {
        if (win.prize && win.prize > 0) {
          allWinnings.push({
            year: win.year,
            amount: win.prize,
          });
        }
      });

      // Group by year and sum amounts
      const yearlyWinningsMap = new Map<number, number>();

      allWinnings.forEach(({ year, amount }) => {
        const currentAmount = yearlyWinningsMap.get(year) || 0;
        yearlyWinningsMap.set(year, currentAmount + amount);
      });

      seasonAwards.forEach((award) => {
        const currentAmount = yearlyWinningsMap.get(award.year) || 0;
        yearlyWinningsMap.set(award.year, currentAmount + award.amount);
      });

      // Convert to array and sort by year descending
      const yearlyWinnings = Array.from(yearlyWinningsMap.entries())
        .map(([year, amount]) => ({ year, amount }))
        .sort((a, b) => b.year - a.year);

      // Calculate lifetime winnings
      const lifetime = yearlyWinnings.reduce(
        (total, { amount }) => total + amount,
        0,
      );

      return {
        yearly: yearlyWinnings,
        lifetime,
      };
    },
    enabled:
      !!userId &&
      !tournamentWinsLoading &&
      !championshipsLoading &&
      !seasonAwardsLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUserSeasonAwards(userId: string | undefined) {
  return useQuery({
    queryKey: ["userSeasonAwards", userId],
    queryFn: async (): Promise<UserSeasonAward[]> => {
      if (!userId) return [];

      const ref = collection(db, "seasonAwards");
      const q = query(ref, where("userId", "==", userId));
      const snapshot = await getDocs(q);

      const rows: UserSeasonAward[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as {
          amount?: unknown;
          seasonYear?: unknown;
          date?: unknown;
          awardType?: unknown;
        };

        const amount = Number(data.amount || 0);
        if (amount <= 0) return;

        const seasonYear = Number(data.seasonYear || 0);
        const rawDate =
          typeof data.date === "object" &&
          data.date !== null &&
          "toDate" in data.date
            ? (data.date as { toDate: () => Date }).toDate()
            : new Date(String(data.date || ""));

        const fallbackYear =
          Number.isNaN(rawDate.getTime()) || rawDate.getFullYear() < 1970
            ? new Date().getFullYear()
            : rawDate.getFullYear();

        rows.push({
          id: d.id,
          amount,
          year: seasonYear || fallbackYear,
        });

        const awardType =
          typeof data.awardType === "string" ? data.awardType : undefined;
        if (awardType && !(awardType in SEASON_AWARD_LABELS)) {
          // Keep query permissive for forward compatibility with future award types.
        }
      });

      return rows;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
