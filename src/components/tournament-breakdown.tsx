import { useState, useMemo } from "react";
import {
  Accordion,
  AccordionItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Badge,
  Skeleton,
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

export function TournamentBreakdown({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { tournaments, isLoading } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { usersMap, isLoading: usersLoading } = useUsersMap();

  const tournamentRows = useMemo(() => {
    return tournaments
      .filter((t) => (t.winners || []).length > 0) // only include tournaments with at least one winner assigned
      .map((t) => {
        const rows: ResultRow[] = [];
        const winnerIds = new Set<string>();
        (t.winners || []).forEach((w: Winner) => {
          w.userIds.forEach((uid, idx) => {
            winnerIds.add(uid);
            const name =
              (w.displayNames && w.displayNames[idx]) ||
              (w.displayNames && w.displayNames[0]) ||
              uid;
            rows.push({
              id: `${t.firestoreId}-${w.place}-${uid}`,
              position: w.place,
              userId: uid,
              name,
              prize: w.prizeAmount || 0,
              score: w.score,
              teamSize: w.userIds.length,
            });
          });
        });
        rows.sort((a, b) => a.position - b.position);
        return { tournament: t, rows, winnersCount: winnerIds.size };
      });
  }, [tournaments]);

  const renderPosition = (pos: number) => {
    let color: any = "default";
    if (pos === 1) color = "warning";
    else if (pos === 2) color = "primary";
    else if (pos === 3) color = "secondary";
    return (
      <Badge
        color={color}
        variant={pos <= 3 ? "solid" : "flat"}
        size="sm"
        className="min-w-8 justify-center"
      >
        {pos}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!tournamentRows.length) {
    return (
      <p className="text-xs text-default-500">
        No tournament results for {year}.
      </p>
    );
  }

  return (
    <div className="px-0 py-2">
      <Accordion
        variant="bordered"
        selectedKeys={open}
        onSelectionChange={(keys: any) => setOpen(new Set(keys))}
        className="px-0"
      >
        {tournamentRows.map(({ tournament, rows, winnersCount }) => (
          <AccordionItem
            key={tournament.firestoreId || tournament.title}
            aria-label={tournament.title}
            title={
              <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:trophy" className="text-amber-500" />
                  <span className="font-medium">{tournament.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Chip size="sm" variant="flat" color="primary">
                    {tournament.date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Chip>
                  <Chip size="sm" variant="flat" color="success">
                    ${tournament.prizePool.toLocaleString()} Prize Pool
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    color="warning"
                    className="font-medium"
                    startContent={
                      <Icon icon="lucide:award" className="w-3 h-3" />
                    }
                  >
                    {winnersCount} {winnersCount === 1 ? "Winner" : "Winners"}
                  </Chip>
                </div>
              </div>
            }
            subtitle={
              <div className="mt-1 text-[11px] text-default-500 flex items-center gap-2">
                <TeeBadge tee={tournament.tee as any} size="xs" />
                <span className="h-1 w-1 rounded-full bg-default-300" />
                <span className="inline-flex items-center gap-1">
                  <Icon icon="lucide:medal" className="w-3 h-3 opacity-60" />
                  {winnersCount} {winnersCount === 1 ? "winner" : "winners"}
                </span>
              </div>
            }
          >
            <div className="mt-4">
              <Table
                aria-label={`${tournament.title} results`}
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
                    const src =
                      (user as any)?.photoURL ||
                      (user as any)?.profileURL ||
                      undefined;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{renderPosition(item.position)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {usersLoading ? (
                              <Skeleton className="hidden h-8 w-8 rounded-full sm:flex" />
                            ) : (
                              <UserAvatar
                                size="sm"
                                className="hidden sm:flex"
                                name={item.name}
                                userId={item.userId}
                                src={src}
                              />
                            )}
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {/* team size detail removed per requirements */}
                            </div>
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
                          <span className="font-semibold">
                            ${item.prize.toLocaleString("en-US")}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  }}
                </TableBody>
              </Table>
            </div>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
