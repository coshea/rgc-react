import { useState } from "react";
import { Select, SelectItem, Tabs, Tab } from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider";
// Replaced legacy leaderboard with new standings component
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";
import { TournamentBreakdown } from "@/components/tournament-breakdown";
import { YearlyTeamWinners } from "@/components/yearly-team-winners";
import { usePageTracking } from "@/hooks/usePageTracking";

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1];

export default function MoneyListPage() {
  usePageTracking("Money List");
  const { userLoggedIn, loading } = useAuth();
  const [year, setYear] = useState<number>(currentYear);
  const [tab, setTab] = useState<string>("yearly");
  if (loading) return <div className="p-4">Loading...</div>;
  if (!userLoggedIn)
    return (
      <div className="p-4 text-sm text-default-500">
        Please sign in to view the money list.
      </div>
    );

  // Errors are handled within sub components via toasts if needed

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Money List</h1>
          <p className="text-[11px] text-default-500">
            Yearly prize earnings & tournament results.
          </p>
        </div>
        <Select
          label="Year"
          size="sm"
          selectedKeys={[String(year)]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];
            if (val) setYear(Number(val));
          }}
          className="w-32"
        >
          {years.map((y) => (
            <SelectItem key={y} textValue={String(y)}>
              {y}
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Mobile view selector */}
      <div className="sm:hidden mb-4">
        <Select
          aria-label="Select leaderboard view"
          size="sm"
          selectedKeys={[tab]}
          onSelectionChange={(keys) => setTab(String(Array.from(keys)[0]))}
          className="max-w-xs"
          variant="bordered"
          label="View"
        >
          <SelectItem key="yearly" textValue="Yearly Standings">
            Yearly Standings
          </SelectItem>
          <SelectItem key="tournaments" textValue="Tournament Breakdown">
            Tournament Breakdown
          </SelectItem>
          <SelectItem key="teams" textValue="Team Winners">
            Team Winners
          </SelectItem>
        </Select>
      </div>

      {/* Desktop tabs */}
      <div className="hidden sm:block mb-6">
        <Tabs
          aria-label="Leaderboard views"
          selectedKey={tab}
          onSelectionChange={(k) => setTab(String(k))}
          variant="underlined"
          color="primary"
        >
          <Tab key="yearly" title="Yearly Standings" />
          <Tab key="tournaments" title="Tournament Breakdown" />
          <Tab key="teams" title="Team Winners" />
        </Tabs>
      </div>

      {/* Content */}
      <div className="mb-6">
        {tab === "yearly" && <YearlyWinningsStandings year={year} />}
        {tab === "tournaments" && <TournamentBreakdown year={year} />}
        {tab === "teams" && <YearlyTeamWinners year={year} />}
      </div>

      <p className="text-[10px] text-default-400 leading-relaxed">
        Prize amounts are per-person shares; team winnings shown per member.
        Data updates live from tournaments.
      </p>
    </div>
  );
}
