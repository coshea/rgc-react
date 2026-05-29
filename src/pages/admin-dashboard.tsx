import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";

import { usePageTracking } from "@/hooks/usePageTracking";
import { PaymentsTab } from "@/components/admin-dashboard/payments-tab";
import { MemberOverviewTab } from "@/components/admin-dashboard/member-overview-tab";
import { TournamentStatusTab } from "@/components/admin-dashboard/tournament-status-tab";
import { NotificationsTab } from "@/components/admin-dashboard/notifications-tab";

type TabKey = "overview" | "payments" | "tournaments" | "notifications";

const VALID_TABS = new Set<TabKey>([
  "overview",
  "payments",
  "tournaments",
  "notifications",
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
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-1 text-muted text-sm">
              Club membership reporting, payments, and tournament status.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Admin Dashboard"
              className="mb-2 overflow-x-auto scrollbar-hide"
            >
              <Tabs.Tab id="overview" aria-label="Members">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:users" className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Members</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="payments" aria-label="Payments">
                <Tabs.Separator />
                <div className="flex items-center gap-2">
                  <Icon
                    icon="lucide:credit-card"
                    className="w-4 h-4 shrink-0"
                  />
                  <span className="hidden sm:inline">Payments</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="tournaments" aria-label="Tournaments">
                <Tabs.Separator />
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:flag" className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Tournaments</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="notifications" aria-label="Notifications">
                <Tabs.Separator />
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:bell" className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Notifications</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="overview">
            <MemberOverviewTab />
          </Tabs.Panel>
          <Tabs.Panel id="payments">
            <PaymentsTab isEmbedded />
          </Tabs.Panel>
          <Tabs.Panel id="tournaments">
            <TournamentStatusTab />
          </Tabs.Panel>
          <Tabs.Panel id="notifications">
            <NotificationsTab />
          </Tabs.Panel>
        </Tabs>
      </div>
    </div>
  );
}
