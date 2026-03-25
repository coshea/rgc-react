import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";

import { usePageTracking } from "@/hooks/usePageTracking";
import { PaymentsTab } from "@/components/admin-dashboard/payments-tab";
import { MemberOverviewTab } from "@/components/admin-dashboard/member-overview-tab";
import { TournamentStatusTab } from "@/components/admin-dashboard/tournament-status-tab";
import { BracketTab } from "@/components/admin-dashboard/bracket-tab";

type TabKey = "overview" | "payments" | "tournaments" | "brackets";

const VALID_TABS = new Set<TabKey>([
  "overview",
  "payments",
  "tournaments",
  "brackets",
]);

function toTabKey(value: string | null): TabKey {
  return value !== null && VALID_TABS.has(value as TabKey)
    ? (value as TabKey)
    : "overview";
}

export default function AdminDashboardPage() {
  usePageTracking("Admin Dashboard");

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = toTabKey(searchParams.get("tab"));

  const handleTabChange = useCallback(
    (key: string | number) => {
      setSearchParams({ tab: key as string }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Icon
            icon="lucide:layout-dashboard"
            className="w-7 h-7 text-primary"
          />
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-default-500 text-sm">
              Club membership reporting, payments, and tournament status.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          aria-label="Admin Dashboard"
          selectedKey={activeTab}
          onSelectionChange={handleTabChange}
          classNames={{ tabList: "mb-2" }}
        >
          <Tab
            key="overview"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="lucide:users" className="w-4 h-4" />
                <span>Members</span>
              </div>
            }
          >
            <MemberOverviewTab />
          </Tab>

          <Tab
            key="payments"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="lucide:credit-card" className="w-4 h-4" />
                <span>Payments</span>
              </div>
            }
          >
            <PaymentsTab isEmbedded />
          </Tab>

          <Tab
            key="tournaments"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="lucide:flag" className="w-4 h-4" />
                <span>Tournaments</span>
              </div>
            }
          >
            <TournamentStatusTab />
          </Tab>

          <Tab
            key="brackets"
            title={
              <div className="flex items-center gap-2">
                <Icon icon="lucide:git-branch" className="w-4 h-4" />
                <span>Brackets</span>
              </div>
            }
          >
            <BracketTab />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}
