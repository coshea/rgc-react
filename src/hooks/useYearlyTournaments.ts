import { useQuery } from "@tanstack/react-query";
import type { Tournament } from "@/types/tournament";
import { TournamentStatus } from "@/types/tournament";
import { getStatus, parseToDate } from "@/utils/tournamentStatus";

interface UseYearlyTournamentsOptions {
  year: number;
  enabled?: boolean;
}

export function useYearlyTournaments({
  year,
  enabled = true,
}: UseYearlyTournamentsOptions) {
  const query = useQuery<Tournament[]>({
    queryKey: ["yearlyTournaments", year],
    enabled,
    queryFn: async () => {
      const start = new Date(year, 0, 1);
      const end = new Date(year + 1, 0, 1);
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
        // eslint-disable-next-line no-console
        console.warn(
          "Yearly tournaments date-range query failed; falling back to full scan:",
          e,
        );
        docsSnap = await getDocs(colRef);
      }
      const tournaments: Tournament[] = [];
      docsSnap.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (!data) return;
        const rawDate = data.date?.toDate ? data.date.toDate() : data.date;
        const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
        if (dateObj.getUTCFullYear() !== year) return; // guard if fallback

        const registrationStart = parseToDate(data.registrationStart);
        const registrationEnd = parseToDate(data.registrationEnd);
        const status: TournamentStatus = getStatus({
          status: data.status as TournamentStatus | undefined,
          registrationStart,
          registrationEnd,
        });
        tournaments.push({
          firestoreId: docSnap.id,
          // required Tournament fields
          title: data.title || "(untitled)",
          date: dateObj,
          description: data.description || "",
          players: data.players || 0,
          status,
          prizePool: data.prizePool || 0,
          winnerGroups: data.winnerGroups || [],
          detailsMarkdown: data.detailsMarkdown,
          tee: data.tee,
          registrationStart,
          registrationEnd,
        });
      });
      return tournaments;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    tournaments: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
