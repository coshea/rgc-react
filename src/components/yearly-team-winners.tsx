import { useMemo, useState } from "react";
import { Card, Chip, Link, Skeleton } from "@heroui/react";
import clsx from "clsx";
import { UserAvatar } from "@/components/avatar";
import { SearchInput } from "@/components/search-input";
import { siteConfig } from "@/config/site";
import type { User } from "@/api/users";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import type { BracketRoundPayout } from "@/types/tournament";
import {
  getBracketRoundsWon,
  isBracketRoundGroup,
  isBracketStandingsGroup,
} from "@/utils/bracketPayouts";
import { ordinal } from "@/utils/standings";
import { formatEventDate, joinNames } from "@/utils/tournamentResults";

interface Props {
  year: number;
}

interface TeamFinish {
  tournamentId: string;
  entryKey: string; // unique key per team entry per tournament/group/place
  title: string;
  date: Date;
  place: number;
  groupLabel: string;
  /** Set for bracket standings, shown in place of the group label. */
  roundsWon?: number;
  /** Match play round payouts count toward money but not wins. */
  isBracketRound: boolean;
  prizePerPlayer: number;
}

export interface TeamAggregate {
  key: string; // sorted joined userIds
  userIds: string[];
  displayNames: string[]; // names stored on the winner entry
  tournaments: TeamFinish[];
  events: number; // distinct tournaments with a team payout
  wins: number; // count of 1st place finishes
  podiums: number; // finishes with place <= 3
  totalPerPlayer: number; // sum of prizePerPlayer per player
  /** Shared by teams with equal earnings (1, 2, 4, 4, 6…). */
  rank: number;
  /** "4th", or "T4" when tied. */
  rankLabel: string;
}

const formatMoney = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Current profile names, falling back to the names stored on the result. */
function teamNames(team: TeamAggregate, usersMap: Map<string, User>): string[] {
  return team.userIds.map((uid, i) => {
    const u = usersMap.get(uid);
    return u?.displayName || u?.email || team.displayNames[i];
  });
}

/** "A & B", "A, B, C & D". */
const joinTeamNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;

const plural = (n: number, word: string, many = `${word}s`) =>
  `${n} ${n === 1 ? word : many}`;

/** Group every multi-player payout by the exact set of players. */
export function aggregateTeams(
  tournaments: {
    firestoreId?: string;
    title: string;
    date: Date | string;
    winnerGroups?: WinnerGroup[];
    bracketRoundPayouts?: BracketRoundPayout[];
  }[],
): TeamAggregate[] {
  const map = new Map<string, Omit<TeamAggregate, "rank" | "rankLabel">>();
  tournaments.forEach((t) => {
    (t.winnerGroups || []).forEach((g: WinnerGroup) => {
      (g.winners || []).forEach((w: WinnerPlace) => {
        const competitors = w.competitors || [];
        if (competitors.length <= 1) return;
        const prizePerPlayer = Number(w.prizeAmount ?? 0);
        if (prizePerPlayer <= 0) return;
        const isBracketRound = isBracketRoundGroup(g);
        const sorted = [...competitors].sort((a, b) =>
          a.userId.localeCompare(b.userId),
        );
        const userIds = sorted.map((c) => c.userId);
        const key = userIds.join("|");
        const groupKey = g.id || g.label || String(g.order ?? "group");
        const tournamentId = t.firestoreId || "unknown";
        const finish: TeamFinish = {
          tournamentId,
          entryKey: [tournamentId, groupKey, String(w.place ?? ""), key].join(
            "|",
          ),
          title: t.title,
          date: t.date instanceof Date ? t.date : new Date(t.date),
          place: w.place,
          groupLabel: g.label,
          roundsWon: isBracketStandingsGroup(g)
            ? getBracketRoundsWon(w, t.bracketRoundPayouts)
            : undefined,
          isBracketRound,
          prizePerPlayer,
        };
        const team = map.get(key) ?? {
          key,
          userIds,
          displayNames: sorted.map((c) => c.displayName || c.userId),
          tournaments: [],
          events: 0,
          wins: 0,
          podiums: 0,
          totalPerPlayer: 0,
        };
        team.tournaments.push(finish);
        if (!isBracketRound && w.place === 1) team.wins += 1;
        if (!isBracketRound && w.place <= 3) team.podiums += 1;
        team.totalPerPlayer += prizePerPlayer;
        map.set(key, team);
      });
    });
  });

  const arr = Array.from(map.values());
  arr.forEach((team) => {
    // Newest first, like the standings breakdown
    team.tournaments.sort((a, b) => b.date.getTime() - a.date.getTime());
    team.events = new Set(team.tournaments.map((f) => f.tournamentId)).size;
  });
  // sort by most amount won per person (desc) -> wins -> podiums -> team size (desc)
  arr.sort((a, b) => {
    if (b.totalPerPlayer !== a.totalPerPlayer)
      return b.totalPerPlayer - a.totalPerPlayer;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    return b.userIds.length - a.userIds.length;
  });
  return arr.map((team) => {
    const rank =
      1 + arr.filter((o) => o.totalPerPlayer > team.totalPerPlayer).length;
    const tied =
      arr.filter((o) => o.totalPerPlayer === team.totalPerPlayer).length > 1;
    return { ...team, rank, rankLabel: tied ? `T${rank}` : ordinal(rank) };
  });
}

function FinishRow({ finish }: { finish: TeamFinish }) {
  const date = formatEventDate(finish.date, { month: "short", day: "numeric" });
  const hasPage = finish.tournamentId !== "unknown";
  const isWin = !finish.isBracketRound && finish.place === 1;
  return (
    <li className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 min-h-11">
      <Chip
        size="sm"
        variant="soft"
        color={isWin ? "warning" : "default"}
        className="justify-self-start"
      >
        {finish.isBracketRound ? "Won" : ordinal(finish.place)}
      </Chip>
      <div className="min-w-0">
        {hasPage ? (
          <Link
            href={`${siteConfig.pages.tournaments.link}/${finish.tournamentId}`}
            className="text-sm wrap-break-word"
          >
            {finish.title}
          </Link>
        ) : (
          <span className="text-sm wrap-break-word">{finish.title}</span>
        )}
        <p className="text-xs text-muted">
          {date}
          {finish.roundsWon !== undefined
            ? `, won ${plural(finish.roundsWon, "match", "matches")}`
            : finish.groupLabel
              ? `, ${finish.groupLabel}`
              : ""}
        </p>
      </div>
      <span className="tabular-nums font-semibold">
        {formatMoney(finish.prizePerPlayer)}
      </span>
    </li>
  );
}

export function YearlyTeamWinners({ year }: Props) {
  const { userLoggedIn, user } = useAuth();
  const { tournaments, isLoading } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap } = useUsersMap();
  const myId = user?.uid;

  const teams = useMemo(() => aggregateTeams(tournaments), [tournaments]);

  const summary = useMemo(() => {
    const paid = teams.reduce(
      (sum, t) => sum + t.totalPerPlayer * t.userIds.length,
      0,
    );
    const events = new Set(
      teams.flatMap((t) => t.tournaments.map((f) => f.tournamentId)),
    ).size;
    return `${plural(teams.length, "team")} won ${formatMoney(paid)} across ${plural(events, "team event")}.`;
  }, [teams]);

  // Filter state must be declared before any early returns to maintain stable hook order
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (!filter.trim()) return teams;
    const q = filter.toLowerCase();
    return teams.filter((t) =>
      teamNames(t, usersMap).join(" ").toLowerCase().includes(q),
    );
  }, [filter, teams, usersMap]);

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {teams.length > 0 && <p className="text-sm text-muted">{summary}</p>}
        <div className="w-full sm:max-w-xs sm:ml-auto">
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Find a team by player"
            ariaLabel="Find a team by player"
            onClear={() => setFilter("")}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">
          {filter
            ? `No teams include “${filter.trim()}”. Try another name.`
            : `No team prizes paid in ${year} yet.`}
        </p>
      ) : (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
          {filtered.map((team) => {
            const names = teamNames(team, usersMap);
            const isMine = !!myId && team.userIds.includes(myId);
            const details = [plural(team.events, "event")];
            if (team.wins) details.push(plural(team.wins, "win"));
            return (
              <li key={team.key} className="flex">
                <Card
                  className={clsx("w-full", isMine && "ring-2 ring-accent")}
                  aria-label={`${team.rankLabel}, ${joinNames(names)}${isMine ? ", your team" : ""}`}
                >
                  <Card.Header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex -space-x-2 mb-2.5">
                        {team.userIds.map((uid, i) => (
                          <UserAvatar
                            key={uid}
                            size="sm"
                            className="ring-2 ring-surface"
                            user={usersMap.get(uid)}
                            name={usersMap.get(uid) ? undefined : names[i]}
                          />
                        ))}
                      </div>
                      <Card.Title className="text-base wrap-break-word">
                        {joinTeamNames(names)}
                      </Card.Title>
                      <Card.Description>{details.join(", ")}</Card.Description>
                    </div>
                    <div className="flex flex-col items-end gap-2.5 tabular-nums">
                      <div className="flex gap-1.5">
                        {isMine && (
                          <Chip size="sm" variant="soft" color="accent">
                            Your team
                          </Chip>
                        )}
                        <Chip
                          size="sm"
                          variant="soft"
                          color={team.rank === 1 ? "warning" : "default"}
                        >
                          {team.rankLabel}
                        </Chip>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold leading-none">
                          {formatMoney(team.totalPerPlayer)}
                        </p>
                        <p className="mt-1 text-xs text-muted">each</p>
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Content>
                    <ul
                      aria-label={`Finishes for ${joinNames(names)}`}
                      className="rounded-2xl bg-surface-secondary divide-y divide-separator"
                    >
                      {team.tournaments.map((f) => (
                        <FinishRow key={f.entryKey} finish={f} />
                      ))}
                    </ul>
                  </Card.Content>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {teams.length > 0 && (
        <p className="text-xs text-muted max-w-prose">
          A team is the same group of players in an event, so a new partner
          starts a new team. Match play rounds count toward money but not wins.
          Teams with equal earnings share a rank.
        </p>
      )}
    </div>
  );
}
