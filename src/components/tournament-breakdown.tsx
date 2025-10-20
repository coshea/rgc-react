import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Skeleton,
  Tooltip,
  Button,
  Card,
  CardBody,
} from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { TeeBadge } from "@/components/tee-badge";
import { Icon } from "@iconify/react";
import { getPlaceMeta } from "@/utils/placeMeta";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { getStatus, statusText } from "@/utils/tournamentStatus";
import { TournamentStatus } from "@/types/tournament";
import { useAuth } from "@/providers/AuthProvider";
import { useUsersMap } from "@/hooks/useUsers";
import type { Winner } from "@/types/winner";

interface Props {
  year: number;
}

interface ResultRow {
  id: string;
  position: number;
  userId: string;
  name: string;
  prize: number;
  score?: string;
  teamSize: number;
}

interface TournamentBundle {
  tournament: any;
  rows: ResultRow[]; // legacy per-player rows (kept for internal use)
  winnersCount: number;
  podium: ResultRow[]; // first 3 distinct position entries
  positions: Map<number, ResultRow[]>; // position -> rows (teams/players)
  teamRows: Array<{
    id: string;
    teamKey: string;
    names: string[];
    userIds: string[];
    totalPrize: number;
    bestPosition?: number;
    score?: string; // representative score (first available)
  }>;
}

export function TournamentBreakdown({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { tournaments, isLoading } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap } = useUsersMap();
  const tournamentBundles: TournamentBundle[] = useMemo(() => {
    return tournaments
      .filter((t) => {
        const hasGroups = (t as any).winnerGroups?.length > 0;
        return hasGroups || (t.winners || []).length > 0;
      })
      .map((t) => {
        const rows: ResultRow[] = [];
        const winnerIds = new Set<string>();
        // Team aggregation across all groups for full results
        const teamMap = new Map<
          string,
          {
            names: string[];
            userIds: string[];
            totalPrize: number;
            bestPosition?: number;
            score?: string;
          }
        >();
        const makeTeamKey = (
          comps: Array<{ userId: string; displayName: string }>
        ) => {
          // Prefer stable by userId; fallback to display names
          const parts = comps.map((c) => c.userId || c.displayName).sort();
          return parts.join("_");
        };
        const groups = (t as any).winnerGroups as
          | Array<{
              type: string;
              winners?: Array<{
                place: number;
                competitors?: Array<{ userId: string; displayName: string }>;
                prizeAmount?: number;
                score?: string;
              }>;
            }>
          | undefined;
        if (groups && groups.length > 0) {
          // Prefer 'overall' groups for podium construction; include all for detailed rows
          groups.forEach((g) => {
            (g.winners || []).forEach((w) => {
              const comps = (w.competitors || []).map((c) => ({
                userId: c.userId,
                displayName: c.displayName || c.userId,
              }));
              comps.forEach((c, idx) => {
                winnerIds.add(c.userId);
                rows.push({
                  id: `${t.firestoreId || t.title}-${g.type}-${w.place}-${c.userId}-${idx}`,
                  position: w.place,
                  userId: c.userId,
                  name: c.displayName || c.userId,
                  prize: w.prizeAmount || 0,
                  score: w.score,
                  teamSize: comps.length,
                });
              });
              // Aggregate team totals
              if (comps.length) {
                const teamKey = makeTeamKey(comps);
                const existing = teamMap.get(teamKey);
                const teamPrize = (w.prizeAmount || 0) * comps.length; // prizeAmount assumed per player share
                const bestPosition = Math.min(
                  w.place,
                  existing?.bestPosition ?? Number.POSITIVE_INFINITY
                );
                teamMap.set(teamKey, {
                  names: existing?.names || comps.map((c) => c.displayName),
                  userIds: existing?.userIds || comps.map((c) => c.userId),
                  totalPrize: (existing?.totalPrize || 0) + teamPrize,
                  bestPosition,
                  score: existing?.score || w.score,
                });
              }
            });
          });
        } else {
          // Legacy winners
          (t.winners || []).forEach((w: Winner) => {
            const ids = w.userIds || [];
            const names = w.displayNames || [];
            ids.forEach((uid, idx) => {
              winnerIds.add(uid);
              rows.push({
                id: `${t.firestoreId || t.title}-${w.place}-${uid}`,
                position: w.place,
                userId: uid,
                name: names[idx] || names[0] || uid,
                prize: w.prizeAmount || 0,
                score: w.score,
                teamSize: ids.length,
              });
            });
            if (ids.length) {
              const comps = ids.map((uid, i) => ({
                userId: uid,
                displayName: names[i] || names[0] || uid,
              }));
              const teamKey = makeTeamKey(comps);
              const existing = teamMap.get(teamKey);
              const teamPrize = (w.prizeAmount || 0) * comps.length; // assume per-player share
              const bestPosition = Math.min(
                w.place,
                existing?.bestPosition ?? Number.POSITIVE_INFINITY
              );
              teamMap.set(teamKey, {
                names: existing?.names || comps.map((c) => c.displayName),
                userIds: existing?.userIds || comps.map((c) => c.userId),
                totalPrize: (existing?.totalPrize || 0) + teamPrize,
                bestPosition,
                score: existing?.score || w.score,
              });
            }
          });
        }
        rows.sort((a, b) => a.position - b.position);
        const positions = new Map<number, ResultRow[]>();
        rows.forEach((r) => {
          const list = positions.get(r.position) || [];
          list.push(r);
          positions.set(r.position, list);
        });
        const distinctPositions = Array.from(positions.keys()).sort(
          (a, b) => a - b
        );
        const podium: ResultRow[] = [];
        distinctPositions.slice(0, 3).forEach((pos) => {
          const group = positions.get(pos)!;
          podium.push(group[0]);
        });
        // Build team rows sorted by total winnings desc (rank), tie-break by best official position then name
        const teamRows = Array.from(teamMap.entries()).map(([teamKey, v]) => ({
          id: `${t.firestoreId || t.title}-team-${teamKey}`,
          teamKey,
          names: v.names,
          userIds: v.userIds,
          totalPrize: v.totalPrize,
          bestPosition: v.bestPosition,
          score: v.score,
        }));
        teamRows.sort((a, b) => {
          if (b.totalPrize !== a.totalPrize) return b.totalPrize - a.totalPrize;
          const ap = a.bestPosition ?? Number.POSITIVE_INFINITY;
          const bp = b.bestPosition ?? Number.POSITIVE_INFINITY;
          if (ap !== bp) return ap - bp;
          return (a.names[0] || "").localeCompare(b.names[0] || "");
        });

        return {
          tournament: t,
          rows,
          winnersCount: winnerIds.size,
          podium,
          positions,
          teamRows,
        };
      });
  }, [tournaments]);

  // Global aggregate stats
  const globalStats = useMemo(() => {
    const withResults = tournamentBundles.length;
    const uniqueWinnerIds = new Set<string>();
    let totalPrize = 0;
    let totalWinnerRows = 0;
    tournamentBundles.forEach((b) => {
      totalPrize += b.tournament.prizePool || 0;
      b.rows.forEach((r) => uniqueWinnerIds.add(r.userId));
      totalWinnerRows += b.rows.length;
    });
    const avgWinners = withResults ? totalWinnerRows / withResults : 0;
    return {
      withResults,
      unique: uniqueWinnerIds.size,
      totalPrize,
      avgWinners,
    };
  }, [tournamentBundles]);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"]; // basic ordinal suffixes
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const PlaceIndicator: React.FC<{ pos: number; compact?: boolean }> = ({
    pos,
    compact = false,
  }) => {
    const meta = getPlaceMeta(pos);
    return (
      <span
        className={
          "inline-flex items-center gap-1 text-[11px] font-semibold min-w-[40px]" +
          (compact ? "" : "")
        }
        aria-label={`${ordinal(pos)} place`}
      >
        <Icon
          icon={meta.icon}
          className={["w-4 h-4", meta.colorClass].join(" ")}
        />
        <span className={meta.colorClass}>{ordinal(pos)}</span>
      </span>
    );
  };

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatPrize = (amount: number) => `$${amount.toLocaleString()}`;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!tournamentBundles.length) {
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-2 text-default-500 text-sm">
          <Icon icon="lucide:calendar-x" className="w-5 h-5" />
          <span>No tournament results for {year}.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Icon icon="lucide:layout-grid" className="text-primary" />
          {year} Tournament Results
        </h2>
        <div className="flex flex-wrap gap-2">
          <Chip
            size="sm"
            variant="flat"
            color="primary"
            startContent={<Icon icon="lucide:trophy" className="w-3 h-3" />}
          >
            {globalStats.withResults} events
          </Chip>
          <Chip
            size="sm"
            variant="flat"
            color="success"
            startContent={<Icon icon="lucide:users" className="w-3 h-3" />}
          >
            {globalStats.unique} unique winners
          </Chip>
          <Chip
            size="sm"
            variant="flat"
            color="warning"
            startContent={<Icon icon="lucide:banknote" className="w-3 h-3" />}
          >
            {formatPrize(globalStats.totalPrize)}
          </Chip>
          <Chip
            size="sm"
            variant="flat"
            color="secondary"
            startContent={<Icon icon="lucide:award" className="w-3 h-3" />}
          >
            {globalStats.avgWinners.toFixed(1)} winners / event
          </Chip>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
        {tournamentBundles.map((bundle) => {
          const { tournament, winnersCount, rows } = bundle;
          const id = tournament.firestoreId || tournament.title;
          const isOpen = expanded.has(id);
          // Build podium summary: keep teams separate and include all tied groups for first 3 distinct positions
          const podiumGroups: { position: number; players: ResultRow[] }[] = [];
          const groups = (tournament as any).winnerGroups as
            | Array<{
                type: string;
                winners?: Array<{
                  place: number;
                  competitors?: Array<{ userId: string; displayName: string }>;
                  prizeAmount?: number;
                  score?: string;
                }>;
                order?: number;
              }>
            | undefined;
          if (groups && groups.length > 0) {
            const overall = groups.filter((g) => g.type === "overall");
            const primary =
              overall.length > 0
                ? overall
                : [
                    [...groups].sort(
                      (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)
                    )[0],
                  ].filter(Boolean as unknown as <T>(x: T) => x is T);

            // Build team-level entries directly from winner places
            type TeamEntry = {
              position: number;
              players: ResultRow[];
              key: string;
            };
            const teamEntries: TeamEntry[] = [];
            primary.forEach((g) => {
              (g.winners || []).forEach((w, wi) => {
                const members = (w.competitors || []).map((c, ci) => ({
                  id: `${id}-podium-${g.type}-w${wi}-p${w.place}-${c.userId}-${ci}`,
                  position: w.place,
                  userId: c.userId,
                  name: c.displayName || c.userId,
                  prize: w.prizeAmount || 0,
                  score: w.score,
                  teamSize: (w.competitors || []).length,
                }));
                if (members.length) {
                  const key = `${g.type}-${w.place}-${members.map((m) => m.userId).join("_")}`;
                  teamEntries.push({
                    position: w.place,
                    players: members,
                    key,
                  });
                }
              });
            });
            teamEntries.sort((a, b) => a.position - b.position);

            // Take first 3 distinct positions, include all teams (ties) for those positions
            const distinctPositions: number[] = [];
            for (const te of teamEntries) {
              if (!distinctPositions.includes(te.position)) {
                distinctPositions.push(te.position);
                if (distinctPositions.length === 3) break;
              }
            }
            const allowedPositions = new Set(distinctPositions);
            teamEntries
              .filter((te) => allowedPositions.has(te.position))
              .forEach((te) =>
                podiumGroups.push({
                  position: te.position,
                  players: te.players,
                })
              );
          } else {
            const seenPositions = new Set<number>();
            rows.forEach((r) => {
              if (seenPositions.size >= 3) return;
              if (!seenPositions.has(r.position)) {
                const group = rows.filter((x) => x.position === r.position);
                podiumGroups.push({ position: r.position, players: group });
                seenPositions.add(r.position);
              }
            });
          }
          return (
            <article
              key={id}
              className="relative overflow-hidden rounded-lg border border-default-200/60 dark:border-default-100/10 bg-content1 shadow-sm hover:shadow-md transition-shadow"
              aria-labelledby={`tournament-${id}`}
            >
              <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
              <Card shadow="none" className="bg-transparent">
                <CardBody className="space-y-4">
                  {/* Header */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3
                          id={`tournament-${id}`}
                          className="font-semibold leading-snug flex items-center gap-2"
                        >
                          <Icon
                            icon="lucide:trophy"
                            className="text-amber-500"
                          />
                          {tournament.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-default-500">
                          <span className="inline-flex items-center gap-1">
                            <Icon icon="lucide:calendar" className="w-3 h-3" />
                            {tournament.date.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="h-1 w-1 rounded-full bg-default-300" />
                          <TeeBadge tee={tournament.tee} size="xs" />
                          <span className="h-1 w-1 rounded-full bg-default-300" />
                          <span className="inline-flex items-center gap-1">
                            <Icon icon="lucide:award" className="w-3 h-3" />
                            {winnersCount}{" "}
                            {winnersCount === 1 ? "winner" : "winners"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-right gap-1">
                        <Chip
                          size="sm"
                          variant="flat"
                          color="success"
                          className="text-[11px]"
                        >
                          {formatPrize(tournament.prizePool)} pool
                        </Chip>
                        {(() => {
                          const s = getStatus(tournament);
                          const label = statusText(s);
                          if (s === TournamentStatus.Canceled) {
                            return (
                              <Chip
                                size="sm"
                                color="danger"
                                variant="solid"
                                className="text-[10px]"
                              >
                                {label}
                              </Chip>
                            );
                          }
                          if (s === TournamentStatus.Completed) {
                            return (
                              <Chip
                                size="sm"
                                color="default"
                                variant="flat"
                                className="text-[10px]"
                              >
                                {label}
                              </Chip>
                            );
                          }
                          if (s === TournamentStatus.Open) {
                            return (
                              <Chip
                                size="sm"
                                color="warning"
                                variant="flat"
                                className="text-[10px]"
                              >
                                {label}
                              </Chip>
                            );
                          }
                          if (s === TournamentStatus.InProgress) {
                            return (
                              <Chip
                                size="sm"
                                color="primary"
                                variant="flat"
                                className="text-[10px]"
                              >
                                {label}
                              </Chip>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Podium strip */}
                  <div className="flex flex-col gap-2">
                    {podiumGroups.map((g) => {
                      // Aggregate names for multi-player teams per position
                      const resolvedNames = g.players.map((p) => {
                        const user = usersMap.get(p.userId);
                        return user?.displayName || user?.email || p.name;
                      });
                      const nameList = resolvedNames.join(" • ");
                      let nameContent: ReactNode;
                      if (resolvedNames.length === 4) {
                        const line1 = resolvedNames.slice(0, 2).join(" • ");
                        const line2 = resolvedNames.slice(2).join(" • ");
                        nameContent = (
                          <>
                            <span>{line1}</span>
                            <br />
                            <span>{line2}</span>
                          </>
                        );
                      } else {
                        nameContent = nameList;
                      }
                      const totalPrize = g.players.reduce(
                        (sum, p) => sum + p.prize,
                        0
                      );
                      const perPlayer = totalPrize / g.players.length || 0;
                      const champion = g.position === 1;
                      return (
                        <div
                          key={`${g.position}-${(g.players || [])
                            .map((p) => p.userId || p.name)
                            .join("_")}`}
                          className={
                            "flex items-center gap-3 p-2 rounded-md bg-default-100/50 dark:bg-default-50/5" +
                            (champion
                              ? " ring-1 ring-amber-400/40 dark:ring-amber-300/30"
                              : "")
                          }
                        >
                          <PlaceIndicator pos={g.position} />
                          {/* Desktop: avatars inline with names */}
                          <div className="hidden sm:flex -space-x-2 rtl:space-x-reverse">
                            {g.players.slice(0, 4).map((p) => {
                              const user = usersMap.get(p.userId);
                              const resolvedName =
                                user?.displayName || user?.email || p.name;
                              return (
                                <UserAvatar
                                  key={p.userId}
                                  size="sm"
                                  className="ring-1 ring-background"
                                  name={resolvedName}
                                  user={user}
                                />
                              );
                            })}
                          </div>
                          {/* Mobile: stack avatars above names */}
                          <div className="flex-1 sm:hidden">
                            <div className="flex justify-center -space-x-2 rtl:space-x-reverse mb-1.5">
                              {g.players.slice(0, 4).map((p) => {
                                const user = usersMap.get(p.userId);
                                const resolvedName =
                                  user?.displayName || user?.email || p.name;
                                return (
                                  <UserAvatar
                                    key={p.userId}
                                    size="sm"
                                    className="ring-1 ring-background"
                                    name={resolvedName}
                                    user={user}
                                  />
                                );
                              })}
                            </div>
                            <p
                              className={
                                "text-sm leading-snug text-center break-words" +
                                (champion ? " font-semibold" : " font-medium")
                              }
                              title={nameList}
                            >
                              {nameContent}
                            </p>
                            <p
                              className="text-[11px] text-default-500 text-center"
                              aria-label={`Score ${g.players[0].score || "not available"}; winnings ${formatPrize(perPlayer)}`}
                            >
                              {g.players[0].score || "—"} •{" "}
                              {formatPrize(perPlayer)}
                            </p>
                          </div>
                          {/* Desktop: names and info */}
                          <div className="hidden sm:block flex-1">
                            <p
                              className={
                                "text-sm leading-snug break-words" +
                                (champion ? " font-semibold" : " font-medium")
                              }
                              title={nameList}
                            >
                              {nameContent}
                            </p>
                            <p
                              className="text-[11px] text-default-500"
                              aria-label={`Score ${g.players[0].score || "not available"}; winnings ${formatPrize(perPlayer)}`}
                            >
                              {g.players[0].score || "—"} •{" "}
                              {formatPrize(perPlayer)}
                            </p>
                          </div>
                          {g.players.length > 4 && (
                            <Tooltip
                              content={g.players
                                .slice(4)
                                .map((p) => p.name)
                                .join(", ")}
                            >
                              <span className="text-[10px] text-default-400">
                                +{g.players.length - 4}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expand button */}
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="light"
                      radius="sm"
                      onPress={() => toggle(id)}
                      endContent={
                        <Icon
                          icon={
                            isOpen ? "lucide:chevron-up" : "lucide:chevron-down"
                          }
                          className="w-4 h-4"
                        />
                      }
                      aria-expanded={isOpen}
                      aria-controls={`results-${id}`}
                    >
                      {isOpen ? "Hide full results" : "Show full results"}
                    </Button>
                  </div>

                  <div
                    id={`results-${id}`}
                    aria-hidden={!isOpen}
                    className={[
                      "mt-2 transition-all duration-300 ease-in-out",
                      isOpen
                        ? "max-h-[80vh] opacity-100 overflow-y-auto"
                        : "max-h-0 opacity-0 overflow-hidden",
                    ].join(" ")}
                  >
                    {isOpen && (
                      <Table
                        aria-label={`${tournament.title} full results`}
                        removeWrapper
                        isStriped
                        classNames={{
                          th: "bg-default-100 text-default-600 font-medium",
                        }}
                      >
                        <TableHeader>
                          <TableColumn key="pos" className="w-12">
                            POS
                          </TableColumn>
                          <TableColumn key="player">PLAYER(S)</TableColumn>
                          <TableColumn
                            key="score"
                            className="hidden sm:table-cell"
                          >
                            SCORE
                          </TableColumn>
                          <TableColumn
                            key="winnings"
                            className="hidden sm:table-cell"
                          >
                            WINNINGS
                          </TableColumn>
                        </TableHeader>
                        <TableBody
                          items={bundle.teamRows}
                          emptyContent="No results"
                        >
                          {(team) => {
                            const rank =
                              bundle.teamRows.findIndex(
                                (t) => t.teamKey === (team as any).teamKey
                              ) + 1;
                            const names: string[] = (team as any).names;
                            const userIds: string[] = (team as any).userIds;
                            const score: string | undefined = (team as any)
                              .score;
                            const totalPrize: number = (team as any).totalPrize;
                            return (
                              <TableRow key={(team as any).id}>
                                <TableCell>
                                  <PlaceIndicator pos={rank} compact />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="hidden sm:flex -space-x-2 rtl:space-x-reverse">
                                      {userIds.slice(0, 4).map((uid, i) => {
                                        const user = usersMap.get(uid);
                                        const fallback = names[i] || uid;
                                        return (
                                          <UserAvatar
                                            key={uid + i}
                                            size="sm"
                                            className="ring-1 ring-background"
                                            user={user}
                                            name={user ? undefined : fallback}
                                          />
                                        );
                                      })}
                                      {userIds.length > 4 && (
                                        <span className="w-7 h-7 rounded-full bg-default-100 flex items-center justify-center text-[10px] font-medium ring-1 ring-default-200">
                                          +{userIds.length - 4}
                                        </span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm leading-tight break-words">
                                        {names.join(" • ")}
                                      </p>
                                      {/* On small screens, show meta under the name to avoid extra columns */}
                                      <p className="sm:hidden text-[11px] text-default-500">
                                        {(score || "—") +
                                          " • " +
                                          formatPrize(totalPrize)}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span
                                    className={
                                      score && score.startsWith("-")
                                        ? "text-success font-medium"
                                        : ""
                                    }
                                  >
                                    {score || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <span className="font-semibold text-sm">
                                    {formatPrize(totalPrize)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          }}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CardBody>
              </Card>
            </article>
          );
        })}
      </div>
    </div>
  );
}
