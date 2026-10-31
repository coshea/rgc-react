import { useState } from "react";
import { Select, Label, ListBox, Spinner } from "@heroui/react";
import { Segment } from "@heroui-pro/react/segment";
import { useAuth } from "@/providers/AuthProvider";
// Replaced legacy leaderboard with new standings component
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";
import { TournamentBreakdown } from "@/components/tournament-breakdown";
import { YearlyTeamWinners } from "@/components/yearly-team-winners";
import { usePageTracking } from "@/hooks/usePageTracking";

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1];

const MONEY_LIST_VIEWS = [
  { id: "yearly", label: "Standings" },
  { id: "tournaments", label: "Tournaments" },
  { id: "teams", label: "Teams" },
] as const;

type MoneyListView = (typeof MONEY_LIST_VIEWS)[number]["id"];

const isMoneyListView = (key: unknown): key is MoneyListView =>
  MONEY_LIST_VIEWS.some((view) => view.id === key);

export default function MoneyListPage() {
  usePageTracking("Money List");
  const { userLoggedIn, loading } = useAuth();
  const [year, setYear] = useState<number>(currentYear);
  const [tab, setTab] = useState<MoneyListView>("yearly");
  if (loading)
    return (
      <div className="p-4 flex justify-center">
        <Spinner aria-label="Loading money list" />
      </div>
    );
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
          <h1 className="text-2xl font-semibold tracking-tight">Money List</h1>
          <p className="text-sm text-muted">
            Prize money paid out at club tournaments this season.
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

      <Segment
        aria-label="Leaderboard views"
        size="lg"
        selectedKey={tab}
        onSelectionChange={(key) => {
          if (isMoneyListView(key)) setTab(key);
        }}
        className="mb-6 w-full sm:w-auto"
      >
        {MONEY_LIST_VIEWS.map((view) => (
          <Segment.Item key={view.id} id={view.id} className="h-11 sm:h-10">
            {view.label}
          </Segment.Item>
        ))}
      </Segment>

      {/* Content */}
      <div className="mb-6">
        {tab === "yearly" && <YearlyWinningsStandings year={year} />}
        {tab === "tournaments" && <TournamentBreakdown year={year} />}
        {tab === "teams" && <YearlyTeamWinners year={year} />}
      </div>
    </div>
  );
}
