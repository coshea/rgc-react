import { useState, useMemo } from "react";
import {
  Select,
  SelectItem,
  Card,
  CardBody,
  addToast,
  Chip,
} from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
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

  const topThree = useMemo(() => winnings.slice(0, 3), [winnings]);

  // For podium layout we want order: 2nd (left, shorter), 1st (center, tallest), 3rd (right, mid)
  const podiumSlots = useMemo(() => {
    const [first, second, third] = [topThree[0], topThree[1], topThree[2]];
    return {
      first,
      second,
      third,
      hasData: !!first,
    };
  }, [topThree]);

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
            const val = Array.from(keys)[0] as string | undefined;
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

      {winnings.length > 0 && (
        <div className="relative">
          <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end mb-2 sm:mb-4 pt-2 sm:pt-4">
            {/* Second Place */}
            <div className="flex flex-col items-center justify-end relative">
              {podiumSlots.second ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <UserAvatar
                      size="md"
                      userId={podiumSlots.second.userId}
                      name={podiumSlots.second.displayName}
                      className="shadow-md"
                    />
                    <p className="text-xs font-medium text-default-600 truncate max-w-[120px] text-center">
                      {podiumSlots.second.displayName}
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
                      ${podiumSlots.second.total.toLocaleString("en-US")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full bg-default-200 dark:bg-default-100/30 rounded-t-md h-20" />
              )}
            </div>
            {/* First Place */}
            <div className="flex flex-col items-center justify-end relative">
              {podiumSlots.first ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <UserAvatar
                      size="lg"
                      userId={podiumSlots.first.userId}
                      name={podiumSlots.first.displayName}
                      className="ring-2 ring-warning shadow-lg"
                    />
                    <p className="text-sm font-semibold text-default-700 truncate max-w-[150px] text-center">
                      {podiumSlots.first.displayName}
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
                      ${podiumSlots.first.total.toLocaleString("en-US")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="w-full bg-warning/70 rounded-t-md h-28" />
              )}
            </div>
            {/* Third Place */}
            <div className="flex flex-col items-center justify-end relative">
              {podiumSlots.third ? (
                <>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <UserAvatar
                      size="md"
                      userId={podiumSlots.third.userId}
                      name={podiumSlots.third.displayName}
                      className="shadow-md"
                    />
                    <p className="text-xs font-medium text-default-600 truncate max-w-[120px] text-center">
                      {podiumSlots.third.displayName}
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
                      ${podiumSlots.third.total.toLocaleString("en-US")}
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
                    );
                  })}
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
