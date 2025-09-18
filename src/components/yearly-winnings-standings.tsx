import { useMemo } from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useAuth } from "@/providers/AuthProvider";

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

  const topThree = useMemo(() => winnings.slice(0, 3), [winnings]);

  return (
    <div className="space-y-6">
      {winnings.length > 0 && (
        <div className="relative">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end mb-2 sm:mb-4 pt-2 sm:pt-4">
            {/* Second */}
            <div className="flex flex-col items-center justify-end relative">
              {topThree[1] ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <UserAvatar
                      size="md"
                      userId={topThree[1].userId}
                      name={topThree[1].displayName}
                      className="shadow-md"
                    />
                    <p className="text-xs font-medium text-default-600 truncate max-w-[120px] text-center">
                      {topThree[1].displayName}
                    </p>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="secondary"
                      className="h-5 text-[10px]"
                    >
                      2nd
                    </Chip>
                  </div>
                  <div className="w-full bg-default-200 dark:bg-default-100/30 rounded-t-md h-20 flex items-end justify-center pb-2">
                    <span className="text-[11px] font-semibold text-default-600">
                      ${topThree[1].total.toLocaleString("en-US")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full bg-default-200 dark:bg-default-100/30 rounded-t-md h-20" />
              )}
            </div>
            {/* First */}
            <div className="flex flex-col items-center justify-end relative">
              {topThree[0] ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <UserAvatar
                      size="lg"
                      userId={topThree[0].userId}
                      name={topThree[0].displayName}
                      className="ring-2 ring-warning shadow-lg"
                    />
                    <p className="text-sm font-semibold text-default-700 truncate max-w-[150px] text-center">
                      {topThree[0].displayName}
                    </p>
                    <Chip
                      size="sm"
                      variant="solid"
                      color="warning"
                      className="h-5 text-[10px]"
                    >
                      1st
                    </Chip>
                  </div>
                  <div className="w-full bg-warning/70 text-warning-900 dark:text-warning-900/90 rounded-t-md h-28 flex items-end justify-center pb-2">
                    <span className="text-[12px] font-bold">
                      ${topThree[0].total.toLocaleString("en-US")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full bg-warning/70 rounded-t-md h-28" />
              )}
            </div>
            {/* Third */}
            <div className="flex flex-col items-center justify-end relative">
              {topThree[2] ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <UserAvatar
                      size="md"
                      userId={topThree[2].userId}
                      name={topThree[2].displayName}
                      className="shadow-md"
                    />
                    <p className="text-xs font-medium text-default-600 truncate max-w-[120px] text-center">
                      {topThree[2].displayName}
                    </p>
                    <Chip
                      size="sm"
                      variant="flat"
                      color="default"
                      className="h-5 text-[10px]"
                    >
                      3rd
                    </Chip>
                  </div>
                  <div className="w-full bg-default-300 dark:bg-default-200/40 rounded-t-md h-16 flex items-end justify-center pb-2">
                    <span className="text-[11px] font-semibold text-default-700">
                      ${topThree[2].total.toLocaleString("en-US")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full bg-default-300 dark:bg-default-200/40 rounded-t-md h-16" />
              )}
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
                  <th className="text-left px-4 py-2">Rank</th>
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-right px-4 py-2">Total ($)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      Loading standings...
                    </td>
                  </tr>
                )}
                {!isLoading && winnings.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      No winnings recorded for {year}.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  winnings.map((row, idx) => {
                    const highlight =
                      idx === 0
                        ? "bg-warning/15 dark:bg-warning/20 ring-1 ring-warning/40"
                        : idx === 1
                          ? "bg-secondary/10"
                          : idx === 2
                            ? "bg-default-200/40 dark:bg-default-200/10"
                            : "";
                    const base =
                      idx % 2 === 0
                        ? "bg-background"
                        : "bg-default-50 dark:bg-default-100/30";
                    return (
                      <tr
                        key={row.userId}
                        className={[base, highlight].filter(Boolean).join(" ")}
                      >
                        <td className="px-4 py-2 font-mono w-16">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium truncate max-w-[200px] sm:max-w-[240px]">
                          {row.displayName}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {row.total
                            .toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 0,
                            })
                            .replace(/^\$/, "")}
                        </td>
                      </tr>
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
