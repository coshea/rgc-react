import { useCallback, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";

import { usePageTracking } from "@/hooks/usePageTracking";
import {
  AdminSectionNav,
  type AdminSection,
} from "@/components/admin-dashboard/admin-section-nav";
import { PaymentsTab } from "@/components/admin-dashboard/payments-tab";
import { MemberOverviewTab } from "@/components/admin-dashboard/member-overview-tab";
import { MemberDataGridTab } from "@/components/admin-dashboard/member-data-grid-tab";
import { TournamentStatusTab } from "@/components/admin-dashboard/tournament-status-tab";
import { NotificationsTab } from "@/components/admin-dashboard/notifications-tab";
import { MembershipSettingsTab } from "@/components/admin-dashboard/membership-settings-tab";
import { SeasonWrappedTab } from "@/components/admin-dashboard/season-wrapped/season-wrapped-tab";

type TabKey =
  | "overview"
  | "members"
  | "payments"
  | "membership"
  | "tournaments"
  | "wrapped"
  | "notifications";

const EmbeddedPaymentsTab = () => <PaymentsTab isEmbedded />;

/**
 * Every admin section, in nav order. Sections sharing a `group` are listed
 * together. To add a section: add its key to `TabKey` and one entry here.
 */
const SECTIONS: readonly (AdminSection<TabKey> & {
  Component: ComponentType;
})[] = [
  {
    key: "overview",
    label: "Overview",
    icon: "lucide:layout-dashboard",
    group: "Club",
    Component: MemberOverviewTab,
  },
  {
    key: "members",
    label: "Members",
    icon: "lucide:users",
    group: "Club",
    Component: MemberDataGridTab,
  },
  {
    key: "payments",
    label: "Payments",
    icon: "lucide:credit-card",
    group: "Club",
    Component: EmbeddedPaymentsTab,
  },
  {
    key: "membership",
    label: "Membership settings",
    icon: "lucide:settings",
    group: "Club",
    Component: MembershipSettingsTab,
  },
  {
    key: "tournaments",
    label: "Tournaments",
    icon: "lucide:flag",
    group: "Season",
    Component: TournamentStatusTab,
  },
  {
    key: "wrapped",
    label: "Season Wrapped",
    icon: "lucide:gift",
    group: "Season",
    Component: SeasonWrappedTab,
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: "lucide:bell",
    group: "Communication",
    Component: NotificationsTab,
  },
];

function toTabKey(value: string | null): TabKey {
  return SECTIONS.find((s) => s.key === value)?.key ?? "overview";
}

export default function AdminDashboardPage() {
  usePageTracking("Admin Dashboard");

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = toTabKey(searchParams.get("tab"));
  const active = SECTIONS.find((s) => s.key === activeTab) ?? SECTIONS[0];

  const handleSelect = useCallback(
    (key: TabKey) => {
      setSearchParams({ tab: key }, { replace: true });
    },
    [setSearchParams],
  );

  return (
    <div className="min-h-screen px-4 pb-12 pt-6 sm:px-6 lg:pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 lg:mb-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Club membership reporting, payments, and tournament status.
          </p>
        </div>

        <div className="lg:flex lg:items-start lg:gap-8">
          <AdminSectionNav
            activeKey={activeTab}
            sections={SECTIONS}
            onSelect={handleSelect}
          />

          <section aria-label={active.label} className="min-w-0 flex-1">
            <active.Component />
          </section>
        </div>
      </div>
    </div>
  );
}
