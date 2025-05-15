import { testTournamentItems } from "@/data/test-tournaments";
import { TournamentCard } from "./tournament-card";

export function TournamentSection() {
  return (
    <section className="py-20 bg-background" id="tournaments">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">2025 Featured Tournaments</h2>
          <p className="text-default-600 max-w-2xl mx-auto">
            Click on a tournament to view details and register
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testTournamentItems.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      </div>
    </section>
  );
}
