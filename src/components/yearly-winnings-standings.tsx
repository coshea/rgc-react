import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Disclosure, Link, Skeleton } from "@heroui/react";
import clsx from "clsx";
import { UserAvatar } from "@/components/avatar";
import { SearchInput } from "@/components/search-input";
import { StandingsPodium } from "@/components/standings-podium";
import { TrophyBadge } from "@/components/trophy-badge";
import { siteConfig } from "@/config/site";
import {
  useYearlyWinnings,
  type WinningsBreakdownItem,
} from "@/hooks/useYearlyWinnings";
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import {
  ordinal,
  rankStandings,
  summarizeSeason,
  type StandingsRow,
} from "@/utils/standings";
import { formatEventDate } from "@/utils/tournamentResults";

interface Props {
  year: number;
}

const formatMoney = (n: number) => `$${n.toLocaleString("en-US")}`;
const rowDomId = (userId: string) => `standing-${userId}`;

// Rank | player | (desktop: events | wins | awards) | earnings | chevron
const ROW_GRID =
  "grid grid-cols-[3.75rem_minmax(0,1fr)_auto_1rem] md:grid-cols-[4.75rem_minmax(0,1fr)_4rem_4rem_5rem_6rem_1rem] items-center gap-3";

function phoneDetail(r: StandingsRow): string {
  const parts = [`${r.events} ${r.events === 1 ? "event" : "events"}`];
  if (r.wins) parts.push(`${r.wins} ${r.wins === 1 ? "win" : "wins"}`);
  if (r.awards) parts.push(`${formatMoney(r.awards)} in awards`);
  return parts.join(", ");
}

function BreakdownItem({ item }: { item: WinningsBreakdownItem }) {
  const isAward = item.source === "season-award";
  const hasPage = !isAward && item.tournamentId !== "unknown";
  const finish = isAward ? "Season award" : `${ordinal(item.place)} place`;
  const date = formatEventDate(item.date, { month: "short", day: "numeric" });
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[4rem_minmax(0,1fr)_8rem_5rem] items-center gap-x-3 gap-y-0.5 py-2.5">
      <span className="hidden md:block tabular-nums text-muted">{date}</span>
      {hasPage ? (
        <Link
          href={`${siteConfig.pages.tournaments.link}/${item.tournamentId}`}
          className="min-w-0 wrap-break-word"
        >
          {item.title}
        </Link>
      ) : (
        <span className="min-w-0 wrap-break-word">{item.title}</span>
      )}
      <span className="hidden md:block text-sm text-muted">{finish}</span>
      <span className="row-span-2 md:row-span-1 text-right tabular-nums font-semibold">
        {formatMoney(item.amount)}
      </span>
      <span className="md:hidden text-sm text-muted">
        {date}, {finish.toLowerCase()}
      </span>
    </li>
  );
}

export function YearlyWinningsStandings({ year }: Props) {
  const { userLoggedIn, user } = useAuth();
  const { winnings, isLoading } = useYearlyWinnings({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap } = useUsersMap();
  const myId = user?.uid;

  const rows = useMemo(() => rankStandings(winnings || []), [winnings]);
  const summary = useMemo(() => summarizeSeason(rows), [rows]);
  const nameOf = useCallback(
    (r: StandingsRow) => usersMap.get(r.userId)?.displayName || r.displayName,
    [usersMap],
  );

  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => nameOf(r).toLowerCase().includes(q));
  }, [rows, filter, nameOf]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const setRowExpanded = useCallback((userId: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, []);

  // Opens a player's row and brings it into view (podium and "you" bar).
  const revealPlayer = useCallback(
    (userId: string) => {
      setFilter("");
      setRowExpanded(userId, true);
      requestAnimationFrame(() => {
        document
          .getElementById(rowDomId(userId))
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [setRowExpanded],
  );

  const myRow = rows.find((r) => r.userId === myId);

  // The phone "you" bar hides while the signed-in player's own row is visible.
  const [myRowVisible, setMyRowVisible] = useState(false);
  const myRowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const el = myRowRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setMyRowVisible(entry.isIntersecting),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [myRow, filtered]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-56 w-full rounded-lg" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-muted">No winnings recorded for {year}.</p>
    );
  }

  return (
    <div className="space-y-5">
      <StandingsPodium
        rows={rows}
        usersMap={usersMap}
        onSelect={revealPlayer}
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted">
          {formatMoney(summary.tournamentsPaid)} paid to {summary.players}{" "}
          {summary.players === 1 ? "player" : "players"} across{" "}
          {summary.tournaments}{" "}
          {summary.tournaments === 1 ? "tournament" : "tournaments"}
          {summary.awardsPaid > 0 &&
            `, plus ${formatMoney(summary.awardsPaid)} in season awards`}
          .
        </p>
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Find a player"
          ariaLabel="Find a player"
          className="w-full md:w-72"
          onClear={() => setFilter("")}
        />
      </div>

      <div className="rounded-lg border border-separator bg-surface overflow-hidden">
        <div
          aria-hidden="true"
          className={clsx(
            ROW_GRID,
            "hidden md:grid px-4 py-2 text-sm text-muted border-b border-separator",
          )}
        >
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Events</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Awards</span>
          <span className="text-right">Earnings</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No players match “{filter.trim()}”.
          </p>
        ) : (
          <ul aria-label="Standings" className="divide-y divide-separator">
            {filtered.map((r) => {
              const isMe = r.userId === myId;
              const user = usersMap.get(r.userId);
              const name = nameOf(r);
              return (
                <li
                  key={r.userId}
                  id={rowDomId(r.userId)}
                  ref={isMe ? myRowRef : undefined}
                  className={clsx("scroll-mt-4", isMe && "bg-accent/10")}
                >
                  <Disclosure
                    isExpanded={expanded.has(r.userId)}
                    onExpandedChange={(open) => setRowExpanded(r.userId, open)}
                  >
                    <Disclosure.Heading>
                      <Button
                        slot="trigger"
                        variant="ghost"
                        fullWidth
                        className={clsx(
                          ROW_GRID,
                          "h-auto min-h-15 rounded-none px-4 py-2.5 text-left font-normal whitespace-normal",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <TrophyBadge rank={r.rank} />
                          <span
                            className={clsx(
                              "tabular-nums text-xl font-semibold",
                              r.rank === 1 && "text-warning",
                            )}
                          >
                            {r.rankLabel}
                          </span>
                        </span>
                        <span className="flex min-w-0 items-center gap-3">
                          <UserAvatar
                            size="sm"
                            user={user}
                            name={user ? undefined : r.displayName}
                            className="hidden sm:inline-flex shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate">{name}</span>
                              {isMe && (
                                <Chip size="sm" variant="soft" color="accent">
                                  You
                                </Chip>
                              )}
                            </span>
                            <span className="block md:hidden text-sm text-muted wrap-break-word">
                              {phoneDetail(r)}
                            </span>
                          </span>
                        </span>
                        <span className="hidden md:block text-right tabular-nums">
                          {r.events}
                          <span className="sr-only"> events</span>
                        </span>
                        <span className="hidden md:block text-right tabular-nums">
                          {r.wins}
                          <span className="sr-only"> wins</span>
                        </span>
                        <span className="hidden md:block text-right tabular-nums text-muted">
                          {r.awards ? formatMoney(r.awards) : "—"}
                          <span className="sr-only"> in awards</span>
                        </span>
                        <span className="text-right tabular-nums text-lg font-semibold">
                          {formatMoney(r.total)}
                        </span>
                        <Disclosure.Indicator className="text-muted" />
                      </Button>
                    </Disclosure.Heading>
                    <Disclosure.Content>
                      <Disclosure.Body className="px-4 pb-4 md:pl-24">
                        <div className="rounded-lg border border-separator bg-surface px-3 md:px-4">
                          <ul
                            aria-label={`${name} earnings`}
                            className="divide-y divide-separator"
                          >
                            {(r.breakdown || []).map((b, i) => (
                              <BreakdownItem
                                key={`${b.tournamentId}-${b.place}-${b.amount}-${i}`}
                                item={b}
                              />
                            ))}
                          </ul>
                        </div>
                      </Disclosure.Body>
                    </Disclosure.Content>
                  </Disclosure>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted max-w-prose">
        Earnings include tournament prizes and season awards such as holes in
        one. Team prizes count as each player's share. Players with equal
        earnings share a rank.
      </p>

      {myRow && !myRowVisible && !filter && (
        <div className="md:hidden sticky bottom-0 -mx-4 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-background/95 backdrop-blur">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onPress={() => revealPlayer(myRow.userId)}
            className="justify-between"
          >
            <span>
              You're {ordinal(myRow.rank)} with {formatMoney(myRow.total)}
            </span>
            <span>Show</span>
          </Button>
        </div>
      )}
    </div>
  );
}
