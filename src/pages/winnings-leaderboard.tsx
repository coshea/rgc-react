import { useState, lazy, Suspense } from "react";
import {
  Select,
  SelectItem,
  Card,
  CardBody,
  Tabs,
  Tab,
  Divider,
  Skeleton,
} from "@heroui/react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useAuth } from "@/providers/AuthProvider";
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";
// Lazy loaded breakdown component for code-splitting
const YearlyWinningsBreakdown = lazy(() =>
  import("@/components/yearly-winnings-breakdown").then((m) => ({
    default: m.YearlyWinningsBreakdown,
  })),
);

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

export default function WinningsLeaderboardPage() {
  usePageTracking("Winnings Leaderboard");
  const { userLoggedIn, loading } = useAuth();
  const [year, setYear] = useState<number>(currentYear);
  const [tab, setTab] = useState<string>("standings");

  if (loading) return <div className="p-4">Loading...</div>;
  if (!userLoggedIn)
    return (
      <div className="p-4 text-sm text-default-500">
        Please sign in to view the leaderboard.
      </div>
    );

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Winnings Leaderboard</h1>
              <p className="text-xs text-default-500 mt-1">
                Podium standings and detailed tournament earnings breakdown.
              </p>
            </div>
            <Select
              label="Year"
              selectedKeys={[String(year)]}
              onSelectionChange={(keys) => {
                const val = Array.from(keys)[0] as string | undefined;
                if (val) setYear(Number(val));
              }}
              className="w-32"
              size="sm"
            >
              {years.map((y) => (
                <SelectItem key={y} textValue={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </Select>
          </div>
          <Divider />
          <Tabs
            aria-label="Winnings views"
            selectedKey={tab}
            onSelectionChange={(k) => setTab(String(k))}
            variant="underlined"
            color="primary"
          >
            <Tab key="standings" title="Standings">
              <YearlyWinningsStandings year={year} />
            </Tab>
            <Tab key="breakdown" title="Breakdown">
              <Suspense
                fallback={
                  <div className="p-4 space-y-4" aria-label="Loading breakdown">
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-6 w-40 rounded" />
                      <Skeleton className="h-4 w-64 rounded" />
                    </div>
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex gap-3 items-center">
                          <Skeleton className="h-4 w-10 rounded" />
                          <Skeleton className="h-4 flex-1 rounded" />
                          <Skeleton className="h-4 w-24 rounded" />
                          <Skeleton className="h-4 w-48 rounded hidden sm:block" />
                        </div>
                      ))}
                    </div>
                  </div>
                }
              >
                <YearlyWinningsBreakdown year={year} />
              </Suspense>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
      <p className="text-[11px] text-default-400">
        Prize amounts are per-person shares. Data is aggregated live from
        tournament documents.
      </p>
    </div>
  );
}
