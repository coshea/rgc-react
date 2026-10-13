import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { TournamentResults } from "@/components/tournament-results";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import type { Tournament } from "@/types/tournament";
import {
  formatEventDate,
  getChampion,
  getPaidPlayerCount,
  getPaidTotal,
  joinNames,
} from "@/utils/tournamentResults";

interface Props {
  year: number;
}

const EVENT_PARAM = "event";

const formatMoney = (amount: number) => `$${amount.toLocaleString()}`;
const eventId = (t: Tournament) => t.firestoreId || t.title;

export function TournamentBreakdown({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { tournaments, isLoading } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap } = useUsersMap();
  const [searchParams, setSearchParams] = useSearchParams();

  // Newest first, only events that have results.
  const events = useMemo(
    () =>
      tournaments
        .filter((t) => (t.winnerGroups?.length ?? 0) > 0)
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [tournaments],
  );

  // On phones the list and the results are separate screens, so the chosen
  // event lives in the URL. On wider screens both show, with the newest event
  // open until one is picked.
  const requestedId = searchParams.get(EVENT_PARAM);
  const requested = events.find((t) => eventId(t) === requestedId);
  const active = requested ?? events[0];
  const showResultsOnPhone = !!requested;

  const selectEvent = (id: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(EVENT_PARAM, id);
      return next;
    });
  };
  const backToList = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(EVENT_PARAM);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex items-center gap-2 text-muted text-sm">
        <Icon icon="lucide:calendar-x" className="w-5 h-5" />
        <span>No tournament results for {year}.</span>
      </div>
    );
  }

  const totalPaid = events.reduce(
    (sum, t) => sum + getPaidTotal(t.winnerGroups),
    0,
  );

  const wonBy = (t: Tournament) => {
    const champion = getChampion(t.winnerGroups);
    if (!champion) {
      const n = getPaidPlayerCount(t.winnerGroups);
      return `${n} ${n === 1 ? "player" : "players"} paid`;
    }
    const names = champion.competitors.map(
      (c) => usersMap.get(c.userId)?.displayName || c.displayName || c.userId,
    );
    return `Won by ${joinNames(names)}`;
  };

  return (
    <div className="md:grid md:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] md:items-start md:gap-6">
      <div className={showResultsOnPhone ? "hidden md:block" : undefined}>
        <p className="text-sm text-muted mb-2">
          {events.length} {events.length === 1 ? "tournament" : "tournaments"},{" "}
          {formatMoney(totalPaid)} paid
          <span className="md:hidden">. Tap one for full results.</span>
        </p>
        <ul
          aria-label="Tournaments with results"
          className="rounded-lg border border-separator bg-surface divide-y divide-separator overflow-hidden"
        >
          {events.map((t) => {
            const id = eventId(t);
            const isActive = active && id === eventId(active);
            return (
              <li key={id}>
                <Button
                  variant="ghost"
                  fullWidth
                  aria-current={isActive ? "true" : undefined}
                  onPress={() => selectEvent(id)}
                  className={
                    "h-auto min-h-14 justify-start gap-3 rounded-none px-4 py-3 text-left font-normal " +
                    (isActive ? "md:bg-accent/10" : "")
                  }
                >
                  <span className="w-14 shrink-0 tabular-nums text-muted">
                    {formatEventDate(t.date, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        "block truncate " + (isActive ? "md:text-accent" : "")
                      }
                    >
                      {t.title}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {wonBy(t)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold">
                    {formatMoney(getPaidTotal(t.winnerGroups))}
                  </span>
                  <Icon
                    icon="lucide:chevron-right"
                    className="w-4 h-4 shrink-0 text-muted md:hidden"
                  />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      {active && (
        <div className={showResultsOnPhone ? undefined : "hidden md:block"}>
          <TournamentResults tournament={active} onBack={backToList} />
        </div>
      )}
    </div>
  );
}
