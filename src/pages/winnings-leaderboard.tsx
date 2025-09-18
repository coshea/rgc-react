import { useState } from "react";
import { Select, SelectItem, Card, CardBody, addToast } from "@heroui/react";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useAuth } from "@/providers/AuthProvider";

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

export default function WinningsLeaderboardPage() {
  const { userLoggedIn, loading } = useAuth();
  const [year, setYear] = useState<number>(currentYear);
  const { winnings, isLoading, isError } = useYearlyWinnings({
    year,
    enabled: userLoggedIn,
  });

  if (loading) return <div className="p-4">Loading...</div>;
  if (!userLoggedIn)
    return (
      <div className="p-4 text-sm text-default-500">
        Please sign in to view the leaderboard.
      </div>
    );

  if (isError) {
    addToast({
      title: "Error",
      description: "Failed to load winnings leaderboard.",
      color: "danger",
    });
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Yearly Winnings Leaderboard</h1>
        <Select
          label="Year"
          selectedKeys={[String(year)]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];
            if (val) setYear(Number(val));
          }}
          className="w-40"
        >
          {years.map((y) => (
            <SelectItem key={y} textValue={String(y)}>
              {y}
            </SelectItem>
          ))}
        </Select>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-default-100 text-default-600 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Rank</th>
                  <th className="text-left px-4 py-2">Player</th>
                  <th className="text-right px-4 py-2">Total ($)</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">
                    Breakdown
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-default-400"
                    >
                      Loading leaderboard...
                    </td>
                  </tr>
                )}
                {!isLoading && winnings.length === 0 && (
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
                  winnings.map((row, idx) => (
                    <tr
                      key={row.userId}
                      className={
                        idx % 2 === 0
                          ? "bg-background"
                          : "bg-default-50 dark:bg-default-100/30"
                      }
                    >
                      <td className="px-4 py-2 font-mono w-16">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium truncate max-w-[200px]">
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
                      <td className="px-4 py-2 hidden md:table-cell align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.breakdown.map((b) => (
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
        Prize amounts are per-person shares. Data is aggregated live from
        tournament documents; consider future pre-aggregation if performance
        becomes a concern.
      </p>
    </div>
  );
}
