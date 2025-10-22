import { TournamentCard } from "./tournament-card";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";

/*
 * Tournament section on the home page displaying a 
list of tournaments in card view
 */
export function TournamentSection() {
  const currentYear = new Date().getFullYear();
  const { tournaments, isLoading: loading } = useYearlyTournaments({
    year: currentYear,
  });

  return (
    <section className="py-20 bg-background" id="tournaments">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">
            {currentYear} Featured Tournaments
          </h2>
          <p className="text-default-600 max-w-2xl mx-auto">
            Click on a tournament to view details and register
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <i className="text-3xl text-primary animate-spin">
                  {/* fallback icon; using inline SVG class to avoid new imports */}
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
                    className="lucide-loader"
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
                <p className="text-foreground-500">Loading tournaments...</p>
              </div>
            </div>
          ) : (
            tournaments.map((tournament) => (
              <TournamentCard
                key={tournament.firestoreId || tournament.title}
                tournament={tournament}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
