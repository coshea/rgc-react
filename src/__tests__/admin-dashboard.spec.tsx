import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import AdminDashboardPage from "@/pages/admin-dashboard";

// Stub the three tab components so routing tests stay isolated from their
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

describe("AdminDashboardPage — tab routing", () => {
  it("defaults to Overview tab when no ?tab param is present", async () => {
    renderPage();
    const overviewTab = await screen.findByRole("tab", { name: /Overview/i });
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
  });

  it("selects Members tab when ?tab=members is in the URL", async () => {
    renderPage("?tab=members");
    const membersTab = await screen.findByRole("tab", { name: /Members/i });
    expect(membersTab).toHaveAttribute("aria-selected", "true");
  });

  it("selects Payments tab when ?tab=payments is in the URL", async () => {
    renderPage("?tab=payments");
    const paymentsTab = await screen.findByRole("tab", { name: /Payments/i });
    expect(paymentsTab).toHaveAttribute("aria-selected", "true");
  });

  it("selects Tournaments tab when ?tab=tournaments is in the URL", async () => {
    renderPage("?tab=tournaments");
    const tournamentsTab = await screen.findByRole("tab", {
      name: /Tournaments/i,
    });
    expect(tournamentsTab).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to Overview tab for an unrecognised ?tab value", async () => {
    renderPage("?tab=foo");
    const overviewTab = await screen.findByRole("tab", { name: /Overview/i });
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
  });
});
