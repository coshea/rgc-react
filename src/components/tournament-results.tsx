import { useMemo } from "react";
import { Button, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useUsersMap } from "@/hooks/useUsers";
import { siteConfig } from "@/config/site";
import type { Tournament } from "@/types/tournament";
import {
  buildSections,
  formatEventDate,
  getPaidPlayerCount,
  getPaidTotal,
  isUnderPar,
  joinNames,
} from "@/utils/tournamentResults";

interface Props {
  tournament: Tournament;
  /** Phone only: returns to the event list. */
  onBack: () => void;
}

const formatMoney = (amount: number) => `$${amount.toLocaleString()}`;

const scrollToSection = (id: string) => {
  document
    .getElementById(`result-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export function TournamentResults({ tournament, onBack }: Props) {
  const { usersMap } = useUsersMap();
  const groups = tournament.winnerGroups;
  const sections = useMemo(() => buildSections(groups), [groups]);
  const paid = getPaidTotal(groups);
  const paidPlayers = getPaidPlayerCount(groups);
  const titleId = `result-title-${tournament.firestoreId ?? tournament.title}`;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border border-separator bg-surface"
    >
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden min-h-11 mt-1 ml-1"
        onPress={onBack}
      >
        <Icon icon="lucide:chevron-left" className="w-5 h-5" />
        Tournaments
      </Button>

      <header className="px-4 pt-3 pb-4 md:p-6 md:pb-4 space-y-3">
        <div>
          <h2 id={titleId} className="text-xl md:text-2xl font-semibold">
            {tournament.title}
          </h2>
          <p className="text-sm text-muted mt-1">
            {formatEventDate(tournament.date, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {tournament.tee ? `, ${tournament.tee.toLowerCase()} tees` : ""}.{" "}
            {formatMoney(paid)} paid to {paidPlayers}{" "}
            {paidPlayers === 1 ? "player" : "players"}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sections.length > 1 && (
            <nav
              aria-label="Jump to section"
              className="flex flex-1 gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap"
            >
              {sections.map((s) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant="outline"
                  className="min-h-11 shrink-0 rounded-full"
                  onPress={() => scrollToSection(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </nav>
          )}
        </div>
        {tournament.firestoreId && (
          <Link
            href={`${siteConfig.pages.tournaments.link}/${tournament.firestoreId}`}
            className="text-sm"
          >
            Open tournament page
          </Link>
        )}
      </header>

      <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-6">
        {sections.map((s) => (
          <section
            key={s.id}
            id={`result-${s.id}`}
            aria-labelledby={`result-heading-${s.id}`}
            className="scroll-mt-4"
          >
            <h3 id={`result-heading-${s.id}`} className="font-medium mb-1">
              {s.label}
            </h3>
            <ol className="divide-y divide-separator">
              {s.entries.map((e) => {
                const names = e.userIds.map((uid, i) => {
                  const user = usersMap.get(uid);
                  return user?.displayName || user?.email || e.fallbackNames[i];
                });
                return (
                  <li
                    key={e.key}
                    className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 py-3 min-h-14"
                  >
                    <span
                      className={
                        "tabular-nums font-semibold " +
                        (s.isCloseToPin
                          ? "text-sm font-normal text-muted"
                          : "text-xl " + (e.isFirst ? "text-warning" : ""))
                      }
                    >
                      {e.placeLabel}
                    </span>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="hidden md:flex -space-x-2 shrink-0">
                        {e.userIds.slice(0, 4).map((uid, i) => (
                          <UserAvatar
                            key={`${uid}-${i}`}
                            size="sm"
                            className="ring-1 ring-background"
                            user={usersMap.get(uid)}
                            name={usersMap.get(uid) ? undefined : names[i]}
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="wrap-break-word">{joinNames(names)}</p>
                        {e.score && (
                          <p
                            className={
                              "text-sm tabular-nums " +
                              (isUnderPar(e.score)
                                ? "text-danger"
                                : "text-muted")
                            }
                          >
                            {e.score}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold">{formatMoney(e.prize)}</p>
                      {e.teamSize > 1 && (
                        <p className="text-xs text-muted">each</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
