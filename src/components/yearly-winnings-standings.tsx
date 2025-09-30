import React, { useMemo, useState, useCallback } from "react";
import { Card, CardBody, Button } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useAuth } from "@/providers/AuthProvider";
import { Icon } from "@iconify/react";
import { SearchInput } from "@/components/search-input";
import { useUsersMap } from "@/hooks/useUsers";
import { getPlaceMeta, formatPlaceLabel } from "@/utils/placeMeta";

interface Props {
  year: number;
}

interface WinningsRow {
  userId: string;
  displayName: string;
  total: number;
  breakdown?: Array<{
    tournamentId: string;
    title: string;
    place: number;
    amount: number;
    date: string | number | Date;
  }>;
  rank: number;
}

export function YearlyWinningsStandings({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { winnings, isLoading } = useYearlyWinnings({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap } = useUsersMap();

  const rows: WinningsRow[] = useMemo(() => {
    const sorted = [...(winnings || [])].sort((a, b) => b.total - a.total);
    return sorted.map((w, idx) => ({ ...w, rank: idx + 1 }));
  }, [winnings]);

  const topThree = useMemo(() => rows.slice(0, 3), [rows]);

  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [rows, filter]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = useCallback((userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Podium */}
      {!isLoading && rows.length > 0 && (
        <div className="flex justify-center">
          <div className="flex items-end gap-4 sm:gap-8 py-2">
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
                        user={u}
                        name={u ? undefined : display}
                        className="shadow-sm mb-1"
                      />
                      {(() => {
                        const meta = getPlaceMeta(2);
                        return (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-default-500">
                            <Icon
                              icon={meta.icon}
                              className={["w-3 h-3", meta.colorClass].join(" ")}
                            />
                            <span>2nd</span>
                          </div>
                        );
                      })()}
                      <p className="text-[11px] mt-1 font-medium text-center truncate max-w-[85px]">
                        {display}
                      </p>
                      <p className="text-[11px] font-semibold text-success-600 mt-0.5">
                        ${topThree[1].total.toLocaleString("en-US")}
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
                        user={u}
                        name={u ? undefined : display}
                        className="shadow-md ring-2 ring-warning mb-1"
                      />
                      {(() => {
                        const meta = getPlaceMeta(1);
                        return (
                          <div className="flex items-center gap-1 text-[12px] font-semibold text-warning-600">
                            <Icon
                              icon={meta.icon}
                              className={["w-4 h-4", meta.colorClass].join(" ")}
                            />
                            <span>1st</span>
                          </div>
                        );
                      })()}
                      <p className="text-[12px] mt-1 font-semibold text-center truncate max-w-[100px]">
                        {display}
                      </p>
                      <p className="text-[12px] font-bold text-success-700 mt-0.5">
                        ${topThree[0].total.toLocaleString("en-US")}
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
                        user={u}
                        name={u ? undefined : display}
                        className="shadow-sm mb-1"
                      />
                      {(() => {
                        const meta = getPlaceMeta(3);
                        return (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-default-500">
                            <Icon
                              icon={meta.icon}
                              className={["w-3 h-3", meta.colorClass].join(" ")}
                            />
                            <span>3rd</span>
                          </div>
                        );
                      })()}
                      <p className="text-[11px] mt-1 font-medium text-center truncate max-w-[85px]">
                        {display}
                      </p>
                      <p className="text-[11px] font-semibold text-success-600 mt-0.5">
                        ${topThree[2].total.toLocaleString("en-US")}
                      </p>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
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

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table className="min-w-full text-sm">
              <thead className="bg-default-100 text-default-600 text-[10px] sm:text-xs uppercase">
                <tr>
                  <th className="text-left px-3 sm:px-4 py-2 w-14 sm:w-16">
                    Rank
                  </th>
                  <th className="text-left px-3 sm:px-4 py-2">Player</th>
                  <th className="hidden sm:table-cell text-left px-4 py-2 w-24">
                    Played
                  </th>
                  <th className="hidden sm:table-cell text-left px-4 py-2 w-28">
                    Wins
                  </th>
                  <th className="text-right px-3 sm:px-4 py-2 w-28 sm:w-32">
                    Winnings
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      Loading standings...
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      {filter
                        ? "No players match filter."
                        : `No winnings recorded for ${year}.`}
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  filtered.map((row) => {
                    const isExpanded = expanded.has(row.userId);
                    const played = row.breakdown?.length || 0;
                    const wins =
                      row.breakdown?.filter((b) => b.place === 1).length || 0;
                    const amountDisplay = row.total.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    });
                    const striped = row.rank % 2 === 0; // zebra
                    return (
                      <React.Fragment key={row.userId}>
                        <tr
                          className={[
                            striped
                              ? "bg-default-50/50 dark:bg-default-50/10"
                              : "bg-background",
                            "transition-colors group cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-50/10",
                            isExpanded
                              ? "border-b border-default-200 dark:border-default-100"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={(e) => {
                            if (
                              (e.target as HTMLElement).closest(
                                "button[data-expander]"
                              )
                            )
                              return;
                            toggle(row.userId);
                          }}
                        >
                          <td className="px-3 sm:px-4 py-2 font-mono w-14 sm:w-16 align-top">
                            <div className="flex items-center gap-1">
                              <span>{row.rank}</span>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => toggle(row.userId)}
                                data-expander
                                aria-expanded={isExpanded}
                                aria-label={
                                  isExpanded
                                    ? `Collapse winnings for ${row.displayName}`
                                    : `Expand winnings for ${row.displayName}`
                                }
                                className="min-w-0 h-auto p-0 text-default-400 hover:text-default-600"
                              >
                                <Icon
                                  icon={
                                    isExpanded
                                      ? "lucide:chevron-down"
                                      : "lucide:chevron-right"
                                  }
                                  className="w-4 h-4"
                                />
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 font-medium truncate max-w-[200px] sm:max-w-[240px] align-top">
                            <div className="flex items-center gap-2 min-w-0">
                              {(() => {
                                const user = usersMap.get(row.userId);
                                return (
                                  <UserAvatar
                                    size="sm"
                                    user={user}
                                    name={user ? undefined : row.displayName}
                                    className="flex-shrink-0"
                                  />
                                );
                              })()}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate max-w-[140px] sm:max-w-[200px] leading-tight">
                                  {row.displayName}
                                </span>
                                <span className="sm:hidden text-[10px] text-default-500 mt-0.5">
                                  {wins} win{wins === 1 ? "" : "s"} • {played}{" "}
                                  played
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 text-xs font-medium text-default-600 tabular-nums">
                            {played}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-2 font-medium tabular-nums text-default-600">
                            {wins}
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-right font-semibold tabular-nums align-top">
                            {amountDisplay}
                          </td>
                        </tr>
                        <tr aria-hidden={!isExpanded}>
                          <td colSpan={5} className="px-0 pb-0 pt-0">
                            <div
                              className={[
                                "overflow-hidden transition-all duration-300 ease-in-out",
                                isExpanded
                                  ? "max-h-[700px] opacity-100"
                                  : "max-h-0 opacity-0",
                              ].join(" ")}
                            >
                              {isExpanded && (
                                <div className="bg-default-50/70 dark:bg-default-50/5 px-6 pt-2 pb-4 border-t border-default-200/60 dark:border-default-100/10">
                                  {row.breakdown && row.breakdown.length > 0 ? (
                                    <div className="space-y-2">
                                      <div className="text-[11px] uppercase tracking-wide text-default-500 font-medium">
                                        Earnings Breakdown
                                      </div>
                                      <ul className="space-y-1.5 overflow-x-hidden">
                                        {row.breakdown.map((b) => {
                                          const dateLabel = new Date(
                                            b.date
                                          ).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                          });
                                          // (badge styling now handled inline with icon-based trophy/medal styles)
                                          return (
                                            <li
                                              key={
                                                b.tournamentId +
                                                b.place +
                                                b.amount
                                              }
                                              className="group relative overflow-hidden rounded-md border border-default-200/60 dark:border-default-100/10 bg-content2/70 dark:bg-content2/20 hover:bg-content2/90 dark:hover:bg-content2/30 transition-colors"
                                            >
                                              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary/60 via-primary/40 to-primary/10 group-hover:from-primary group-hover:via-primary/70 group-hover:to-primary/30 transition-colors" />
                                              <div className="pl-3 pr-2 py-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <span
                                                    className="font-medium truncate max-w-[150px] sm:max-w-[200px]"
                                                    title={b.title}
                                                  >
                                                    {b.title}
                                                  </span>
                                                  <span className="hidden sm:inline text-default-300 dark:text-default-600">
                                                    •
                                                  </span>
                                                  {(() => {
                                                    const meta = getPlaceMeta(
                                                      b.place
                                                    );
                                                    return (
                                                      <span
                                                        className={[
                                                          "inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 tabular-nums ring-1 ring-black/5 dark:ring-white/5",
                                                          meta.badgeBg,
                                                        ].join(" ")}
                                                        aria-label={formatPlaceLabel(
                                                          b.place
                                                        )}
                                                      >
                                                        <Icon
                                                          icon={meta.icon}
                                                          className={[
                                                            "w-3 h-3",
                                                            b.place === 1
                                                              ? ""
                                                              : "opacity-80",
                                                          ].join(" ")}
                                                        />
                                                        <span>
                                                          {formatPlaceLabel(
                                                            b.place
                                                          )}
                                                        </span>
                                                      </span>
                                                    );
                                                  })()}
                                                </div>
                                                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] sm:justify-end">
                                                  <span className="font-semibold tabular-nums text-default-800 dark:text-default-200">
                                                    $
                                                    {b.amount.toLocaleString(
                                                      "en-US",
                                                      {
                                                        minimumFractionDigits: 0,
                                                      }
                                                    )}
                                                  </span>
                                                  <span className="text-default-400 hidden sm:inline">
                                                    •
                                                  </span>
                                                  <span className="text-default-500 tabular-nums">
                                                    {dateLabel}
                                                  </span>
                                                </div>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-default-400 py-3">
                                      No per-tournament breakdown available.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
