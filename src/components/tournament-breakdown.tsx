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
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
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
  rows: ResultRow[];
  winnersCount: number;
  podium: ResultRow[]; // first 3 distinct position entries
  positions: Map<number, ResultRow[]>; // position -> rows (teams/players)
}

export function TournamentBreakdown({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { tournaments, isLoading } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap, isLoading: usersLoading } = useUsersMap();
  const tournamentBundles: TournamentBundle[] = useMemo(() => {
    return tournaments
      .filter((t) => {
        const hasGroups = (t as any).winnerGroups?.length > 0;
        return hasGroups || (t.winners || []).length > 0;
      })
      .map((t) => {
        const rows: ResultRow[] = [];
        const winnerIds = new Set<string>();
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
          // Prefer overall groups for podium; still include all groups for rows
          groups.forEach((g) => {
            (g.winners || []).forEach((w) => {
              (w.competitors || []).forEach((c, idx) => {
                winnerIds.add(c.userId);
                rows.push({
                  id: `${t.firestoreId || t.title}-${g.type}-${w.place}-${c.userId}-${idx}`,
                  position: w.place,
                  userId: c.userId,
                  name: c.displayName || c.userId,
                  prize: w.prizeAmount || 0,
                  score: w.score,
                  teamSize: (w.competitors || []).length,
                });
              });
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
        return {
          tournament: t,
          rows,
          winnersCount: winnerIds.size,
          podium,
          positions,
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
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const renderPosition = (pos: number) => {
    // Custom high-contrast badge (avoid avatar overlap) – using flex box, fixed width
    const base =
      "flex items-center justify-center rounded-md text-[11px] font-semibold w-7 h-7 shrink-0 ring-1 ring-black/5 dark:ring-white/10";
    let style =
      "bg-default-200 text-default-700 dark:bg-default-100/20 dark:text-default-300";
    if (pos === 1)
      style =
        "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-amber-950 dark:text-amber-50 shadow-sm";
    else if (pos === 2)
      style =
        "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-800 dark:from-slate-500 dark:via-slate-400 dark:to-slate-300 dark:text-slate-950";
    else if (pos === 3)
      style =
        "bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 text-purple-50 shadow-sm";
    return (
      <span
        aria-label={`${ordinal(pos)} place`}
        className={`${base} ${style}`}
        data-rank={pos}
      >
        {pos}
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
          // Build podium summary (positions map may contain multiple per position for teams)
          const podiumGroups: { position: number; players: ResultRow[] }[] = [];
          const seenPositions = new Set<number>();
          rows.forEach((r) => {
            if (seenPositions.size >= 3) return;
            if (!seenPositions.has(r.position)) {
              const group = rows.filter((x) => x.position === r.position);
              podiumGroups.push({ position: r.position, players: group });
              seenPositions.add(r.position);
            }
          });
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
                          <TeeBadge tee={tournament.tee as any} size="xs" />
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
                        {tournament.registrationOpen && (
                          <Chip
                            size="sm"
                            color="danger"
                            variant="flat"
                            className="text-[10px]"
                          >
                            Registration Open
                          </Chip>
                        )}
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
                          key={g.position}
                          className={
                            "flex items-center gap-3 p-2 rounded-md bg-default-100/50 dark:bg-default-50/5" +
                            (champion
                              ? " ring-1 ring-amber-400/40 dark:ring-amber-300/30"
                              : "")
                          }
                        >
                          {renderPosition(g.position)}
                          <div className="flex -space-x-2 rtl:space-x-reverse">
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
                          <div className="flex-1 min-w-0">
                            <p
                              className={
                                "text-sm leading-tight" +
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
                      "mt-2 overflow-hidden transition-all duration-300 ease-in-out",
                      isOpen
                        ? "max-h-[640px] opacity-100"
                        : "max-h-0 opacity-0",
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
                          <TableColumn key="pos">POS</TableColumn>
                          <TableColumn key="player">PLAYER</TableColumn>
                          <TableColumn key="score">SCORE</TableColumn>
                          <TableColumn key="winnings">WINNINGS</TableColumn>
                        </TableHeader>
                        <TableBody items={rows} emptyContent="No results">
                          {(item: ResultRow) => {
                            const user = usersMap.get(item.userId);
                            const resolvedName =
                              user?.displayName || user?.email || item.name;
                            return (
                              <TableRow key={item.id}>
                                <TableCell>
                                  {renderPosition(item.position)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {usersLoading ? (
                                      <Skeleton className="hidden h-7 w-7 rounded-full sm:flex" />
                                    ) : (
                                      <UserAvatar
                                        size="sm"
                                        className="hidden sm:flex"
                                        name={resolvedName}
                                        user={user}
                                      />
                                    )}
                                    <p className="font-medium text-sm leading-tight">
                                      {resolvedName}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      item.score && item.score.startsWith("-")
                                        ? "text-success font-medium"
                                        : ""
                                    }
                                  >
                                    {item.score || "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="font-semibold text-sm">
                                    {formatPrize(item.prize)}
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
