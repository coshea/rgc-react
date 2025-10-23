import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Skeleton,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useUsersMap } from "@/hooks/useUsers";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { useAuth } from "@/providers/AuthProvider";
import { SearchInput } from "@/components/search-input";

interface Props {
  year: number;
}

export function YearlyMoneyLeaderboard({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { winnings, isLoading: loadingWinnings } = useYearlyWinnings({
    year,
    enabled: userLoggedIn,
  });
  const { tournaments, isLoading: loadingTournaments } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap, isLoading: loadingUsers } = useUsersMap();
  const [filter, setFilter] = useState("");

  // Build map of wins & tournaments played per user
  const stats = useMemo(() => {
    const played = new Map<string, number>();
    const wins = new Map<string, number>();
    tournaments.forEach((t) => {
      const participantSet = new Set<string>();
      if (t.winnerGroups && t.winnerGroups.length > 0) {
        // Count any competitor in any group as "played"
        for (const g of t.winnerGroups) {
          for (const w of g.winners || []) {
            w.competitors?.forEach((c) => participantSet.add(c.userId));
          }
        }
        // Wins: only count from 'overall' group if present; otherwise, pick a single primary group
        const overall = t.winnerGroups.filter((g) => g.type === "overall");
        const primaryGroups =
          overall.length > 0
            ? overall
            : [
                // choose the first group by order asc if available; otherwise first in array
                [...t.winnerGroups].sort(
                  (a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)
                )[0],
              ].filter(Boolean as unknown as <T>(x: T) => x is T);
        primaryGroups.forEach((g) => {
          g.winners?.forEach((w) => {
            if (w.place === 1) {
              w.competitors?.forEach((c) => {
                wins.set(c.userId, (wins.get(c.userId) || 0) + 1);
              });
            }
          });
        });
      }
      participantSet.forEach((uid) => {
        played.set(uid, (played.get(uid) || 0) + 1);
      });
    });
    return { played, wins };
  }, [tournaments]);

  const rows = useMemo(() => {
    return winnings.map((w, idx) => ({
      rank: idx + 1,
      userId: w.userId,
      displayName: w.displayName,
      winnings: w.total,
      played: stats.played.get(w.userId) || 0,
      wins: stats.wins.get(w.userId) || 0,
    }));
  }, [winnings, stats]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [filter, rows]);

  const isLoading = loadingWinnings || loadingTournaments || loadingUsers;
  const topThree = filtered.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Search player"
          ariaLabel="Filter players"
          className="w-full sm:w-64"
          onClear={() => setFilter("")}
        />
        <div className="text-[11px] text-default-500">
          {filtered.length} player{filtered.length === 1 ? "" : "s"}
        </div>
      </div>
      {/* Podium Section */}
      {!isLoading && topThree.length > 0 && (
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end justify-center gap-3 sm:gap-8 py-1 sm:py-2">
            {/* Second */}
            <div className="flex flex-col items-center w-20 sm:w-24">
              {topThree[1] &&
                (() => {
                  const u = usersMap.get(topThree[1].userId);
                  const display = u?.displayName || topThree[1].displayName;
                  return (
                    <>
                      <UserAvatar
                        size="sm"
                        name={u ? undefined : display}
                        user={u}
                        className="shadow-sm mb-1"
                      />
                      <div className="flex items-center gap-1 text-[11px] font-medium text-default-500">
                        <Icon
                          icon="lucide:medal"
                          className="w-3 h-3 text-default-400"
                        />
                        <span>2nd</span>
                      </div>
                      <p className="text-[11px] mt-1 font-medium text-center truncate max-w-[85px]">
                        {display}
                      </p>
                      <p className="text-[11px] font-semibold text-success-600 mt-0.5">
                        ${topThree[1].winnings.toLocaleString("en-US")}
                      </p>
                    </>
                  );
                })()}
            </div>
            {/* First */}
            <div className="flex flex-col items-center w-24 sm:w-28">
              {topThree[0] &&
                (() => {
                  const u = usersMap.get(topThree[0].userId);
                  const display = u?.displayName || topThree[0].displayName;
                  return (
                    <>
                      <UserAvatar
                        size="md"
                        name={u ? undefined : display}
                        user={u}
                        className="shadow-md ring-2 ring-warning mb-1"
                      />
                      <div className="flex items-center gap-1 text-[12px] font-semibold text-warning-600">
                        <Icon icon="lucide:trophy" className="w-4 h-4" />
                        <span>1st</span>
                      </div>
                      <p className="text-[12px] mt-1 font-semibold text-center truncate max-w-[100px]">
                        {display}
                      </p>
                      <p className="text-[12px] font-bold text-success-700 mt-0.5">
                        ${topThree[0].winnings.toLocaleString("en-US")}
                      </p>
                    </>
                  );
                })()}
            </div>
            {/* Third */}
            <div className="flex flex-col items-center w-20 sm:w-24">
              {topThree[2] &&
                (() => {
                  const u = usersMap.get(topThree[2].userId);
                  const display = u?.displayName || topThree[2].displayName;
                  return (
                    <>
                      <UserAvatar
                        size="sm"
                        name={u ? undefined : display}
                        user={u}
                        className="shadow-sm mb-1"
                      />
                      <div className="flex items-center gap-1 text-[11px] font-medium text-default-500">
                        <Icon
                          icon="lucide:medal"
                          className="w-3 h-3 text-amber-700"
                        />
                        <span>3rd</span>
                      </div>
                      <p className="text-[11px] mt-1 font-medium text-center truncate max-w-[85px]">
                        {display}
                      </p>
                      <p className="text-[11px] font-semibold text-success-600 mt-0.5">
                        ${topThree[2].winnings.toLocaleString("en-US")}
                      </p>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
        <Table
          aria-label="Yearly money leaderboard"
          removeWrapper
          isStriped
          classNames={{
            th: "bg-default-100 text-default-600 font-medium text-[11px] whitespace-nowrap",
          }}
        >
          <TableHeader>
            <TableColumn key="rank">RANK</TableColumn>
            <TableColumn key="player">PLAYER</TableColumn>
            <TableColumn key="played" className="hidden sm:table-cell">
              PLAYED
            </TableColumn>
            <TableColumn key="wins" className="hidden sm:table-cell">
              WINS
            </TableColumn>
            <TableColumn key="winnings">WINNINGS</TableColumn>
          </TableHeader>
          <TableBody
            items={filtered}
            loadingState={isLoading ? "loading" : "idle"}
            emptyContent={
              !isLoading && filtered.length === 0
                ? filter
                  ? "No players match filter."
                  : "No winnings yet."
                : undefined
            }
          >
            {(item: any) => {
              const u = usersMap.get(item.userId);
              const display = u?.displayName || item.displayName;
              return (
                <TableRow
                  key={item.userId}
                  className="transition-colors hover:bg-default-50"
                >
                  {(columnKey) => {
                    switch (columnKey) {
                      case "rank":
                        return (
                          <TableCell>
                            <span
                              className={
                                "font-semibold " +
                                (item.rank <= 3 ? "text-primary-600" : "")
                              }
                            >
                              {item.rank}
                            </span>
                          </TableCell>
                        );
                      case "player": {
                        const user = usersMap.get(item.userId);
                        return (
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {isLoading ? (
                                <Skeleton className="hidden h-8 w-8 rounded-full sm:flex" />
                              ) : (
                                <UserAvatar
                                  size="sm"
                                  className="hidden sm:flex"
                                  name={display}
                                  user={user}
                                />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium leading-tight truncate max-w-[160px]">
                                  {display}
                                </p>
                                <div className="sm:hidden mt-1 text-[10px] text-default-500 flex gap-2">
                                  <span className="whitespace-nowrap">
                                    {item.played} played
                                  </span>
                                  {item.wins > 0 && (
                                    <span className="whitespace-nowrap">
                                      {item.wins}{" "}
                                      {item.wins === 1 ? "win" : "wins"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        );
                      }
                      case "played":
                        return (
                          <TableCell className="hidden sm:table-cell">
                            {item.played}
                          </TableCell>
                        );
                      case "wins":
                        return (
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center">
                              {item.wins > 0 && (
                                <Chip size="sm" variant="flat" color="success">
                                  {item.wins === 1
                                    ? "1 win"
                                    : `${item.wins} wins`}
                                </Chip>
                              )}
                            </div>
                          </TableCell>
                        );
                      case "winnings":
                        return (
                          <TableCell>
                            <span className="font-semibold whitespace-nowrap">
                              ${item.winnings.toLocaleString("en-US")}
                            </span>
                          </TableCell>
                        );
                      default:
                        return (
                          <TableCell>
                            <span />
                          </TableCell>
                        );
                    }
                  }}
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      </div>
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}
    </div>
  );
}
