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
              className="transition-colors hover:bg-default-50"
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
