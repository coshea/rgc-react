import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import AdminDashboardPage from "@/pages/admin-dashboard";

// Stub every section component so routing tests stay isolated from their
// own data-fetching dependencies.
vi.mock("@/components/admin-dashboard/member-overview-tab", () => ({
  MemberOverviewTab: () => <div>Overview Tab Content</div>,
}));

vi.mock("@/components/admin-dashboard/member-data-grid-tab", () => ({
  MemberDataGridTab: () => <div>Members Tab Content</div>,
}));

vi.mock("@/components/admin-dashboard/payments-tab", () => ({
  PaymentsTab: () => <div>Payments Tab Content</div>,
}));

vi.mock("@/components/admin-dashboard/tournament-status-tab", () => ({
  TournamentStatusTab: () => <div>Tournaments Tab Content</div>,
}));

vi.mock("@/components/admin-dashboard/membership-settings-tab", () => ({
  MembershipSettingsTab: () => <div>Membership Tab Content</div>,
}));

vi.mock("@/hooks/usePageTracking", () => ({
  usePageTracking: () => {},
}));

function renderPage(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/admin/dashboard${search}`]}>
      <AdminDashboardPage />
    </MemoryRouter>,
  );
}

vi.mock("@/components/admin-dashboard/notifications-tab", () => ({
  NotificationsTab: () => <div>Notifications Tab Content</div>,
}));

// The desktop sidebar marks the active section with aria-current="page".
function sidebar() {
  return screen.getByRole("navigation", { name: "Admin sections" });
}

function expectActive(name: RegExp, content: string) {
  const link = within(sidebar()).getByRole("button", { name });

  expect(link).toHaveAttribute("aria-current", "page");
  expect(screen.getByText(content)).toBeInTheDocument();
}

describe("AdminDashboardPage — section routing", () => {
  it("defaults to Overview when no ?tab param is present", () => {
    renderPage();
    expectActive(/^Overview$/, "Overview Tab Content");
  });

  it.each([
    ["members", /^Members$/, "Members Tab Content"],
    ["payments", /^Payments$/, "Payments Tab Content"],
    ["membership", /^Membership settings$/, "Membership Tab Content"],
    ["tournaments", /^Tournaments$/, "Tournaments Tab Content"],
    ["notifications", /^Notifications$/, "Notifications Tab Content"],
  ])("selects %s from ?tab", (tab, name, content) => {
    renderPage(`?tab=${tab}`);
    expectActive(name, content);
  });

  it("falls back to Overview for an unrecognised ?tab value", () => {
    renderPage("?tab=foo");
    expectActive(/^Overview$/, "Overview Tab Content");
  });

  it("switches sections from the sidebar", async () => {
    renderPage();
    fireEvent.click(within(sidebar()).getByRole("button", { name: /^Payments$/ }));
    expect(await screen.findByText("Payments Tab Content")).toBeInTheDocument();
    expect(
      within(sidebar()).getByRole("button", { name: /^Payments$/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("shows the active section in the phone picker", () => {
    renderPage("?tab=tournaments");
    expect(
      screen.getByRole("button", { name: /Admin section: Tournaments/ }),
    ).toBeInTheDocument();
  });
});
