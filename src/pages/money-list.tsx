import { useState } from "react";
import {
  Select,
  SelectItem,
  Card,
  CardBody,
  CardHeader,
  Tabs,
  Tab,
  Divider,
} from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider";
import { YearlyMoneyLeaderboard } from "@/components/yearly-money-leaderboard";
import { TournamentBreakdown } from "@/components/tournament-breakdown";
import { YearlyTeamWinners } from "@/components/yearly-team-winners";

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

export default function MoneyListPage() {
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
    <div className="p-4 mx-auto max-w-6xl space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Money List
              </h1>
              <p className="text-xs text-default-500 mt-1">
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
          <Divider />
        </CardHeader>
        <CardBody className="pt-0">
          <Tabs
            aria-label="Leaderboard views"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(String(k))}
            variant="underlined"
            color="primary"
          >
            <Tab key="yearly" title="Yearly Standings">
              <YearlyMoneyLeaderboard year={year} />
            </Tab>
            <Tab key="tournaments" title="Tournament Breakdown">
              <TournamentBreakdown year={year} />
            </Tab>
            <Tab key="teams" title="Team Winners">
              <YearlyTeamWinners year={year} />
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
      <p className="text-[11px] text-default-400 leading-relaxed">
        Prize amounts are per-person shares; team winnings shown per member.
        Data loads live from tournaments.
      </p>
    </div>
  );
}
