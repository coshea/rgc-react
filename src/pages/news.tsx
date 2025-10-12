import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus } from "@/utils/tournamentStatus";
import { db } from "@/config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import React from "react";
import { Link } from "react-router-dom";

export function NewsPage() {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      try {
        const colRef = collection(db, "tournaments");
        const q = query(colRef, orderBy("date", "asc"));
        const snap = await getDocs(q);
        const items: Tournament[] = snap.docs.map((d) => {
          const data: any = d.data();
          const dateField =
            data.date && typeof data.date.toDate === "function"
              ? data.date.toDate()
              : data.date
                ? new Date(data.date)
                : new Date();

          const status: TournamentStatus = getStatus({
            status: data.status as TournamentStatus | undefined,
          });

          return {
            firestoreId: d.id,
            title: data.title,
            date: dateField,
            description: data.description,
            players: data.players,
            status,
            icon: data.icon,
            href: data.href,
            prizePool: data.prizePool || 0,
            winners: data.winners || [],
            winnerGroups: data.winnerGroups || [],
          } as Tournament;
        });
        setTournaments(items);
      } catch (err) {
        console.error("Failed to load tournaments", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  const now = new Date();

  const nextTournament = tournaments
    .filter(
      (t) =>
        t.status !== TournamentStatus.Completed &&
        t.status !== TournamentStatus.Canceled &&
        t.date > now
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const lastCompletedTournament = tournaments
    .filter((t) => t.status === TournamentStatus.Completed && t.date <= now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  return (
    <section className="flex flex-col items-center justify-center ">
      <div className="container mx-auto max-w-6xl px-4">
        {/** --- Header --- */}
        <h1 className="text-3xl font-bold mb-4">Latest News</h1>
        <p className="text-default-600 mb-8">
          Stay updated with the latest news and events at Ridgefield Golf Club.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <i className="text-3xl text-primary animate-spin">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                </i>
                <p className="text-foreground-500">Loading news...</p>
              </div>
            </div>
          ) : (
            <>
              {lastCompletedTournament && (
                <div className="bg-content2 p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-2">
                    Previous Tournament Results
                  </h2>
                  <p className="text-default-500 mb-4">
                    The most recent tournament, {lastCompletedTournament.title},
                    was held on{" "}
                    {lastCompletedTournament.date.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })}
                    .
                  </p>
                  <Link
                    to={
                      lastCompletedTournament.firestoreId
                        ? `/tournaments/${lastCompletedTournament.firestoreId}`
                        : lastCompletedTournament.href || "#"
                    }
                    className="text-primary hover:underline"
                    aria-label={`View details for ${lastCompletedTournament.title}`}
                  >
                    View the results
                  </Link>
                </div>
              )}

              {nextTournament && (
                <div className="bg-content1 p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-semibold mb-2">
                    Upcoming Tournament
                  </h2>
                  <p className="text-default-500 mb-4">
                    Join us for the {nextTournament.title} on{" "}
                    {nextTournament.date.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })}
                    . Register now!
                  </p>
                  <Link
                    to={
                      nextTournament.firestoreId
                        ? `/tournaments/${nextTournament.firestoreId}`
                        : nextTournament.href || "#"
                    }
                    className="text-primary hover:underline"
                    aria-label={`Read more about ${nextTournament.title}`}
                  >
                    Read more
                  </Link>
                </div>
              )}
            </>
          )}
          {/* Add more news articles as needed */}
        </div>
      </div>
    </section>
  );
}
