import { useMemo } from "react";
import { Card, CardBody, Skeleton } from "@heroui/react";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useAuth } from "@/providers/AuthProvider";

interface Props {
  year: number;
}

/**
 * YearlyWinningsBreakdown
 * Shows detailed per-player tournament breakdown chips plus total earnings.
 * Podium & rank highlighting intentionally omitted (handled in standings component).
 */
export function YearlyWinningsBreakdown({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { winnings, isLoading } = useYearlyWinnings({
    year,
    enabled: userLoggedIn,
  });

  const rows = useMemo(
    () =>
      winnings.map((w, idx) => ({
        rank: idx + 1,
        ...w,
      })),
    [winnings]
  );

  const totalPayout = useMemo(
    () => winnings.reduce((sum, w) => sum + (w.total || 0), 0),
    [winnings]
  );

  const maxTotal = useMemo(() => (rows.length ? rows[0].total : 0), [rows]);

  const loadingSkeletonRows = Array.from({ length: 5 }).map((_, i) => (
    <tr key={i} className="animate-pulse">
      <td className="px-4 py-2 w-16">
        <Skeleton className="h-3 w-6 rounded" />
      </td>
      <td className="px-4 py-2">
        <Skeleton className="h-3 w-40 rounded" />
      </td>
      <td className="px-4 py-2 text-right">
        <Skeleton className="h-3 w-10 rounded ml-auto" />
      </td>
      <td className="px-4 py-2">
        <Skeleton className="h-5 w-full rounded" />
      </td>
    </tr>
  ));

  function chipColor(amount: number, place: number) {
    if (place === 1)
      return "bg-success-100 text-success-700 dark:text-success-500";
    if (place === 2)
      return "bg-warning-100 text-warning-700 dark:text-warning-500";
    if (place === 3)
      return "bg-danger-100 text-danger-700 dark:text-danger-500";
    // scale by relative winnings vs leader
    const ratio = maxTotal ? amount / maxTotal : 0;
    if (ratio > 0.6)
      return "bg-primary-100 text-primary-700 dark:text-primary-400";
    if (ratio > 0.3)
      return "bg-default-200 text-default-700 dark:text-default-400";
    return "bg-default-100 text-default-500 dark:text-default-400";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {year} Winnings Breakdown
        </h2>
        {!isLoading && rows.length > 0 && (
          <div className="text-xs text-default-500 flex items-center gap-4">
            <span>
              Players: <strong>{rows.length}</strong>
            </span>
            <span>
              Total Payout:{" "}
              {totalPayout.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
              })}
            </span>
            <span className="hidden sm:inline">Leader: {maxTotal}</span>
          </div>
        )}
      </div>
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto max-h-[560px]">
            <table className="min-w-full text-sm relative">
              <thead className="sticky top-0 z-10 bg-content1/95 backdrop-blur supports-[backdrop-filter]:bg-content1/60 text-default-600 text-xs uppercase shadow-sm">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Rank</th>
                  <th className="text-left px-4 py-2 font-medium">Player</th>
                  <th className="text-right px-4 py-2 font-medium">
                    Total ($)
                  </th>
                  <th className="text-left px-4 py-2 font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default-200/60 dark:divide-default-100/10">
                {isLoading && loadingSkeletonRows}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-default-400 text-sm"
                    >
                      No winnings recorded for {year}.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  rows.map((row, i) => (
                    <tr
                      key={row.userId}
                      className={
                        "group transition-colors " +
                        (i % 2 === 1
                          ? "bg-default-50/40 dark:bg-default-50/5"
                          : "") +
                        " hover:bg-primary-50/60 dark:hover:bg-primary-50/10"
                      }
                    >
                      <td className="px-4 py-2 font-mono w-16 tabular-nums text-xs text-default-500 group-hover:text-default-700 dark:group-hover:text-default-300">
                        {row.rank}
                      </td>
                      <td className="px-4 py-2 font-medium truncate max-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate" title={row.displayName}>
                            {row.displayName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {row.total
                          .toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 0,
                          })
                          .replace(/^\$/, "")}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.breakdown.map((b: any) => (
                            <span
                              key={b.tournamentId + b.place + b.amount}
                              className={
                                "text-[10px] px-2 py-1 rounded-md font-medium tracking-tight shadow-sm border border-default-200/40 dark:border-default-100/10 " +
                                chipColor(b.amount, b.place)
                              }
                              title={`${b.title} • Place ${b.place} • $${b.amount}`}
                            >
                              {b.title}: ${b.amount}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      <p className="text-[11px] text-default-400">
        Breakdown displays raw shares per tournament. Podium highlighting lives
        in the Standings tab.
      </p>
    </div>
  );
}
