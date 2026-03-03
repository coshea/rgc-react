import { TournamentCard } from "./tournament-card";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { Button, Card, CardBody, Skeleton } from "@heroui/react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";

/*
 * Tournament section on the home page displaying a 
list of tournaments in card view
 */
export function TournamentSection() {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const { data: latestYear, isLoading: latestYearLoading } = useQuery<
    number | null
  >({
    queryKey: ["latestTournamentYear"],
    queryFn: async () => {
      const { db } = await import("@/config/firebase");
      const { collection, query, orderBy, limit, getDocs } = await import(
        "firebase/firestore"
      );

      const colRef = collection(db, "tournaments");
      const snap = await getDocs(
        query(colRef, orderBy("date", "desc"), limit(1)),
      );
      if (snap.empty) return null;

      const data = snap.docs[0]?.data();
      const rawDate = data?.date?.toDate ? data.date.toDate() : data?.date;
      const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return null;
      return dateObj.getUTCFullYear();
    },
    staleTime: 1000 * 60 * 5,
  });

  const yearToShow = latestYear ?? currentYear;
  const { tournaments, isLoading: tournamentsLoading } = useYearlyTournaments({
    year: yearToShow,
    enabled: !latestYearLoading,
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // For mobile: show most recent past tournament + next 2 upcoming
  const getDisplayTournaments = () => {
    if (!isMobile) return tournaments;

    const now = new Date();
    const past = tournaments.filter((t) => t.date < now);
    const upcoming = tournaments.filter((t) => t.date >= now);

    // Get most recent past tournament
    const recentPast = past.length > 0 ? [past[past.length - 1]] : [];
    // Get next 2 upcoming tournaments
    const nextTwo = upcoming.slice(0, 2);

    return [...recentPast, ...nextTwo];
  };

  const displayTournaments = getDisplayTournaments();

  return (
    <section className="py-8 bg-background overflow-x-hidden" id="tournaments">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              {yearToShow} Featured Tournaments
            </h2>
            <p className="text-sm text-default-600">
              Click on a tournament to view details and register
            </p>
          </div>
          <Button
            size="sm"
            variant="flat"
            onPress={() => navigate("/tournaments")}
            endContent={<Icon icon="lucide:arrow-right" className="w-3 h-3" />}
            className="self-start sm:self-auto"
          >
            View All
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {latestYearLoading || tournamentsLoading
            ? Array.from({ length: isMobile ? 3 : 4 }).map((_, idx) => (
                <Card key={idx} className="w-full">
                  <CardBody className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4 rounded-lg" />
                    <Skeleton className="h-4 w-1/2 rounded-lg" />
                    <Skeleton className="h-4 w-full rounded-lg" />
                    <Skeleton className="h-4 w-5/6 rounded-lg" />
                    <div className="pt-2 flex justify-between items-center">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-8 w-24 rounded-lg" />
                    </div>
                  </CardBody>
                </Card>
              ))
            : displayTournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.firestoreId || tournament.title}
                  tournament={tournament}
                />
              ))}
        </div>
      </div>
    </section>
  );
}
