import { TournamentItems } from "@/data/test-tournaments";

export function NewsPage() {
  // Find the next upcoming tournament (not completed, not canceled, soonest date in the future)
  const now = new Date();

  const nextTournament = TournamentItems.filter(
    (t) => !t.completed && !t.canceled && t.date > now
  ).sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  // Find the most recently completed tournament (completed, not canceled, date <= now, latest date)
  const lastCompletedTournament = TournamentItems.filter(
    (t) => t.completed && !t.canceled && t.date <= now
  ).sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  return (
    <section className="flex flex-col items-center justify-center ">
      <div className="container mx-auto max-w-6xl px-4">
        {/** --- Header --- */}
        <h1 className="text-3xl font-bold mb-4">Latest News</h1>
        <p className="text-default-600 mb-8">
          Stay updated with the latest news and events at Ridgefield Golf Club.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lastCompletedTournament && (
            <div className="bg-content2 p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-2">
                Previous Tournament Results
              </h2>
              <p className="text-default-500 mb-4">
                The most recent tournament, {lastCompletedTournament.title}, was
                held on{" "}
                {lastCompletedTournament.date.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                })}
                .
              </p>
              <a
                href={lastCompletedTournament.href || "#"}
                className="text-primary hover:underline"
              >
                View results
              </a>
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
              <a
                href={nextTournament.href || "#"}
                className="text-primary hover:underline"
              >
                Read more
              </a>
            </div>
          )}
          {/* Add more news articles as needed */}
        </div>
      </div>
    </section>
  );
}
