import { useMemo } from "react";
import { Card, CardBody } from "@heroui/react";
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

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-default-100 text-default-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Rank</th>
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-right px-4 py-2">Total ($)</th>
                  <th className="text-left px-4 py-2">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      Loading breakdown...
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      No winnings recorded for {year}.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  rows.map((row) => (
                    <tr
                      key={row.userId}
                      className="hover:bg-default-50 transition-colors"
                    >
                      <td className="px-4 py-2 font-mono w-16">{row.rank}</td>
                      <td className="px-4 py-2 font-medium truncate max-w-[240px]">
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
                      <td className="px-4 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.breakdown.map((b: any) => (
                            <span
                              key={b.tournamentId + b.place + b.amount}
                              className="text-[11px] px-2 py-1 rounded-md bg-content2 text-default-600 dark:text-default-400"
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
        Breakdown displays raw shares per tournament. For podium highlighting
        see Standings tab.
      </p>
    </div>
  );
}
