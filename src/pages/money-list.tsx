import { useState } from "react";
import { Select, Tabs, Label, ListBox } from "@heroui/react";
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
      <div className="p-4 text-sm text-muted">
        Please sign in to view the money list.
      </div>
    );

  // Errors are handled within sub components via toasts if needed

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Money List</h1>
          <p className="text-[11px] text-muted">
            Yearly earnings (tournament winnings + season awards).
          </p>
        </div>
        <Select
          value={String(year)}
          onChange={(key) => {
            if (key) setYear(Number(key));
          }}
          className="w-32"
        >
          <Label>Year</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {years.map((y) => (
                <ListBox.Item key={y} id={String(y)} textValue={String(y)}>
                  {y}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Mobile view selector */}
      <div className="sm:hidden mb-4">
        <Select
          aria-label="Select leaderboard view"
          value={tab}
          onChange={(key) => {
            if (key) setTab(String(key));
          }}
          className="max-w-xs"
        >
          <Label>View</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="yearly" textValue="Yearly Standings">
                Yearly Standings
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="tournaments" textValue="Tournament Breakdown">
                Tournament Breakdown
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="teams" textValue="Team Winners">
                Team Winners
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Desktop tabs */}
      <div className="hidden sm:block mb-6">
        <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Leaderboard views">
              <Tabs.Tab id="yearly">
                Yearly Standings
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="tournaments">
                <Tabs.Separator />
                Tournament Breakdown
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="teams">
                <Tabs.Separator />
                Team Winners
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>

      {/* Content */}
      <div className="mb-6">
        {tab === "yearly" && <YearlyWinningsStandings year={year} />}
        {tab === "tournaments" && <TournamentBreakdown year={year} />}
        {tab === "teams" && <YearlyTeamWinners year={year} />}
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        Prize amounts are per-person shares; team winnings shown per member.
        Totals include season awards (e.g. hole in one). Data updates live from
        tournaments and awards.
      </p>
    </div>
  );
}
