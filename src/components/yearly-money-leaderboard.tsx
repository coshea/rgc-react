import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Chip,
  Skeleton,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { useAuth } from "@/providers/AuthProvider";

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
  const [filter, setFilter] = useState("");

  // Build map of wins & tournaments played per user
  const stats = useMemo(() => {
    const played = new Map<string, number>();
    const wins = new Map<string, number>();
    tournaments.forEach((t) => {
      if (!t.winners) return;
      const participantSet = new Set<string>();
      t.winners.forEach((w) => {
        w.userIds.forEach((uid) => {
          participantSet.add(uid);
        });
        if (w.place === 1) {
          w.userIds.forEach((uid) => {
            wins.set(uid, (wins.get(uid) || 0) + 1);
          });
        }
      });
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

  const isLoading = loadingWinnings || loadingTournaments;
  const topThree = filtered.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <Input
          placeholder="Search player"
          size="sm"
          value={filter}
          onValueChange={setFilter}
          aria-label="Filter players"
          className="w-full sm:w-64"
          isClearable
          onClear={() => setFilter("")}
        />
        <div className="text-[11px] text-default-500">
          {filtered.length} player{filtered.length === 1 ? "" : "s"}
        </div>
      </div>
      {/* Podium Section */}
      {!isLoading && topThree.length > 0 && (
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end justify-center gap-4 sm:gap-8 py-2">
            {/* Second */}
            <div className="flex flex-col items-center w-24">
              {topThree[1] && (
                <>
                  <UserAvatar
                    size="sm"
                    userId={topThree[1].userId}
                    name={topThree[1].displayName}
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
                    {topThree[1].displayName}
                  </p>
                  <p className="text-[11px] font-semibold text-success-600 mt-0.5">
                    ${topThree[1].winnings.toLocaleString("en-US")}
                  </p>
                </>
              )}
            </div>
            {/* First */}
            <div className="flex flex-col items-center w-28">
              {topThree[0] && (
                <>
                  <UserAvatar
                    size="md"
                    userId={topThree[0].userId}
                    name={topThree[0].displayName}
                    className="shadow-md ring-2 ring-warning mb-1"
                  />
                  <div className="flex items-center gap-1 text-[12px] font-semibold text-warning-600">
                    <Icon icon="lucide:trophy" className="w-4 h-4" />
                    <span>1st</span>
                  </div>
                  <p className="text-[12px] mt-1 font-semibold text-center truncate max-w-[100px]">
                    {topThree[0].displayName}
                  </p>
                  <p className="text-[12px] font-bold text-success-700 mt-0.5">
                    ${topThree[0].winnings.toLocaleString("en-US")}
                  </p>
                </>
              )}
            </div>
            {/* Third */}
            <div className="flex flex-col items-center w-24">
              {topThree[2] && (
                <>
                  <UserAvatar
                    size="sm"
                    userId={topThree[2].userId}
                    name={topThree[2].displayName}
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
                    {topThree[2].displayName}
                  </p>
                  <p className="text-[11px] font-semibold text-success-600 mt-0.5">
                    ${topThree[2].winnings.toLocaleString("en-US")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <Table
        aria-label="Yearly money leaderboard"
        removeWrapper
        isStriped
        classNames={{
          th: "bg-default-100 text-default-600 font-medium text-[11px]",
        }}
      >
        <TableHeader>
          <TableColumn key="rank">RANK</TableColumn>
          <TableColumn key="player">PLAYER</TableColumn>
          <TableColumn key="played">PLAYED</TableColumn>
          <TableColumn key="wins">WINS</TableColumn>
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
          {(item: any) => (
            <TableRow
              key={item.userId}
              className={
                "transition-colors hover:bg-default-50 " +
                (item.rank === 1
                  ? "bg-warning/15 dark:bg-warning/20"
                  : item.rank === 2
                    ? "bg-secondary/10"
                    : item.rank === 3
                      ? "bg-default-200/40 dark:bg-default-200/10"
                      : "")
              }
            >
              {(columnKey) => {
                switch (columnKey) {
                  case "rank":
                    return (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "font-semibold " +
                              (item.rank <= 3 ? "text-primary-600" : "")
                            }
                          >
                            {item.rank}
                          </span>
                        </div>
                      </TableCell>
                    );
                  case "player":
                    return (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            size="sm"
                            userId={item.userId}
                            name={item.displayName}
                            className="hidden sm:flex"
                          />
                          <div>
                            <p className="font-medium">{item.displayName}</p>
                          </div>
                        </div>
                      </TableCell>
                    );
                  case "played":
                    return <TableCell>{item.played}</TableCell>;
                  case "wins":
                    return (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{item.wins}</span>
                          {item.wins > 0 && (
                            <Chip size="sm" variant="flat" color="success">
                              {item.wins === 1 ? "1 win" : `${item.wins} wins`}
                            </Chip>
                          )}
                        </div>
                      </TableCell>
                    );
                  case "winnings":
                    return (
                      <TableCell>
                        <span className="font-semibold">
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
          )}
        </TableBody>
      </Table>
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
