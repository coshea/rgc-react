import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { TournamentStatusCard } from "@/components/tournament-status-card";
import { mapTournamentDoc, onAllTournaments } from "@/api/tournaments";
import { TournamentStatus, type Tournament } from "@/types/tournament";

// ─── Hook: real-time upcoming tournaments ─────────────────────────────────────

function useUpcomingTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAllTournaments(
      (snap: { docs: unknown[] }) => {
        const all = (snap.docs as Parameters<typeof mapTournamentDoc>[0][]).map(
          mapTournamentDoc,
        );
        setTournaments(
          all.filter(
            (t) =>
              t.status === TournamentStatus.Upcoming ||
              t.status === TournamentStatus.InProgress,
          ),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  return { tournaments, loading };
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TournamentStatusTab() {
  const { tournaments, loading } = useUpcomingTournaments();

  return (
    <div className="space-y-4">
      <p className="text-sm text-default-500">
        {loading
          ? "Loading…"
          : tournaments.length === 0
            ? "No upcoming tournaments."
            : `${tournaments.length} upcoming or in-progress tournament${
                tournaments.length !== 1 ? "s" : ""
              }.`}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-default-400">
          <Icon icon="lucide:calendar-check" className="w-12 h-12 opacity-40" />
          <p className="text-sm">No upcoming or in-progress tournaments.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentStatusCard
              key={t.firestoreId ?? t.title}
              tournament={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
