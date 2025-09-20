import React, { useMemo, useState, useCallback } from "react";
import { Card, CardBody, Input } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useAuth } from "@/providers/AuthProvider";
import { Icon } from "@iconify/react";
import { useUsersMap } from "@/hooks/useUsers";

interface Props {
  year: number;
}

/**
 * YearlyWinningsStandings
 * Shows podium (top 3) + condensed standings table (rank, player, total winnings).
 * Breakdown chips intentionally excluded; see YearlyWinningsBreakdown component.
 */
export function YearlyWinningsStandings({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { winnings, isLoading } = useYearlyWinnings({
    year,
    enabled: userLoggedIn,
  });
  const { usersMap } = useUsersMap();

  // Build rows with stable rank based on full winnings ordering
  const rows = useMemo(
    () =>
      winnings.map((w, idx) => ({
        ...w,
        rank: idx + 1,
      })),
    [winnings]
  );

  // Filtering
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => r.displayName.toLowerCase().includes(q));
  }, [filter, rows]);

  // Podium should always reflect overall (unfiltered) top 3
  const topThree = useMemo(() => rows.slice(0, 3), [rows]);

  // Track which user rows are expanded (store userId set)
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
      {/* Search & meta */}
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

      {/* Podium Section (legacy style) */}
      {!isLoading && topThree.length > 0 && (
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end justify-center gap-3 sm:gap-8 py-1 sm:py-2">
            {/* Second */}
            <div className="flex flex-col items-center w-20 sm:w-24">
              {topThree[1] &&
                (() => {
                  const u = usersMap.get(topThree[1].userId);
                  const display =
                    (u && ((u as any).displayName || (u as any).name)) ||
                    topThree[1].displayName;
                  const src =
                    (u as any)?.photoURL || (u as any)?.profileURL || undefined;
                  return (
                    <>
                      <UserAvatar
                        size="sm"
                        userId={topThree[1].userId}
                        name={display}
                        src={src}
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
                  const display =
                    (u && ((u as any).displayName || (u as any).name)) ||
                    topThree[0].displayName;
                  const src =
                    (u as any)?.photoURL || (u as any)?.profileURL || undefined;
                  return (
                    <>
                      <UserAvatar
                        size="md"
                        userId={topThree[0].userId}
                        name={display}
                        src={src}
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
                  const display =
                    (u && ((u as any).displayName || (u as any).name)) ||
                    topThree[2].displayName;
                  const src =
                    (u as any)?.photoURL || (u as any)?.profileURL || undefined;
                  return (
                    <>
                      <UserAvatar
                        size="sm"
                        userId={topThree[2].userId}
                        name={display}
                        src={src}
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
                        ${topThree[2].total.toLocaleString("en-US")}
                      </p>
                    </>
                  );
                })()}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table className="min-w-full text-sm">
              <thead className="bg-default-100 text-default-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 w-16">Rank</th>
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-left px-4 py-2 w-24">Played</th>
                  <th className="text-left px-4 py-2 w-28">Wins</th>
                  <th className="text-right px-4 py-2 w-32">Winnings</th>
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
                    const idx = row.rank - 1; // stable original index
                    const isExpanded = expanded.has(row.userId);
                    // Removed special highlighting for top 3 ranks to keep rows uniform
                    const highlight = "";
                    const base =
                      idx % 2 === 0
                        ? "bg-background"
                        : "bg-default-50 dark:bg-default-100/30";
                    const amountDisplay = row.total.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                    });
                    const played = row.breakdown?.length || 0;
                    const wins =
                      row.breakdown?.filter((b: any) => b.place === 1).length ||
                      0;
                    return (
                      <React.Fragment key={row.userId}>
                        <tr
                          className={[
                            base,
                            highlight,
                            "transition-colors group cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-50/10",
                            isExpanded
                              ? "border-b border-default-200 dark:border-default-100"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={(e) => {
                            // Avoid double toggle if button inside cell was clicked
                            if (
                              (e.target as HTMLElement).closest(
                                "button[data-expander]"
                              )
                            )
                              return;
                            toggle(row.userId);
                          }}
                        >
                          <td className="px-4 py-2 font-mono w-16">
                            <button
                              type="button"
                              onClick={() => toggle(row.userId)}
                              aria-expanded={isExpanded}
                              aria-label={
                                isExpanded
                                  ? `Collapse winnings for ${row.displayName}`
                                  : `Expand winnings for ${row.displayName}`
                              }
                              className="flex items-center gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                              data-expander
                            >
                              <span>{row.rank}</span>
                              <Icon
                                icon={
                                  isExpanded
                                    ? "lucide:chevron-down"
                                    : "lucide:chevron-right"
                                }
                                className="w-3.5 h-3.5 text-default-400 group-hover:text-default-600 transition-colors"
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                          <td className="px-4 py-2 font-medium truncate max-w-[200px] sm:max-w-[240px]">
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                size="sm"
                                userId={row.userId}
                                name={row.displayName}
                                className="flex-shrink-0"
                              />
                              <span className="truncate max-w-[160px] sm:max-w-[200px]">
                                {row.displayName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs font-medium text-default-600 tabular-nums">
                            {played}
                          </td>
                          <td className="px-4 py-2 font-medium tabular-nums text-default-600">
                            {wins}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">
                            {amountDisplay}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-default-50/70 dark:bg-default-50/5">
                            <td colSpan={5} className="px-6 pb-4 pt-2">
                              {row.breakdown && row.breakdown.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-[11px] uppercase tracking-wide text-default-500 font-medium">
                                    Earnings Breakdown
                                  </div>
                                  <ul className="space-y-1">
                                    {row.breakdown.map((b) => (
                                      <li
                                        key={
                                          b.tournamentId + b.place + b.amount
                                        }
                                        className="flex flex-wrap items-center gap-2 text-xs bg-content2/60 dark:bg-content2/30 rounded-md px-2 py-1 border border-default-200/50 dark:border-default-100/10"
                                      >
                                        <span
                                          className="font-medium truncate max-w-[140px]"
                                          title={b.title}
                                        >
                                          {b.title}
                                        </span>
                                        <span className="text-default-400">
                                          •
                                        </span>
                                        <span className="tabular-nums">
                                          Place {b.place}
                                        </span>
                                        <span className="text-default-400">
                                          •
                                        </span>
                                        <span className="font-semibold tabular-nums">
                                          $
                                          {b.amount.toLocaleString("en-US", {
                                            minimumFractionDigits: 0,
                                          })}
                                        </span>
                                        <span className="text-default-400">
                                          •
                                        </span>
                                        <span className="text-default-500 tabular-nums">
                                          {new Date(b.date).toLocaleDateString(
                                            "en-US",
                                            {
                                              month: "short",
                                              day: "numeric",
                                            }
                                          )}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-xs text-default-400">
                                  No per-tournament breakdown available.
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
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
