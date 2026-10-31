import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PaymentsTab } from "@/components/admin-dashboard/payments-tab";

const year = new Date().getFullYear();

vi.mock("@/hooks/useMembers", () => ({
  useMembers: () => ({
    allMembers: [
      { id: "u1", displayName: "Alice Member", email: "alice@example.com" },
    ],
    loading: false,
  }),
}));

vi.mock("@/hooks/useMembershipPayments", () => ({
  useMembershipPayments: () => ({
    isLoading: false,
    data: [
      {
        id: "dues",
        userId: "u1",
        year,
        amount: 85,
        method: "paypal",
        membershipType: "full",
        status: "confirmed",
        purpose: "dues",
        groupId: "ORDER1",
        paidAt: { toMillis: () => Date.UTC(year, 2, 1) },
      },
    ],
  }),
}));

vi.mock("@/api/membership", async (orig) => ({
  ...(await orig<typeof import("@/api/membership")>()),
  getMembershipSettings: async () => ({
    fullMembershipPrice: 85,
    handicapMembershipPrice: 50,
  }),
}));

vi.mock("@/hooks/usePageTracking", () => ({ usePageTracking: () => {} }));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("@/components/membership/hooks", () => ({
  useAdminFlag: () => ({ isAdmin: true, loadingAdmin: false }),
  useBoardMemberFlag: () => ({ isBoardMember: false, loadingBoard: false }),
}));
vi.mock("@/providers/toast", () => ({ addToast: vi.fn() }));

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PaymentsTab isEmbedded />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function tile(title: string) {
  const card = screen
    .getByText(title, { selector: "dt" })
    .closest('[data-slot="kpi"]');
  if (!(card instanceof HTMLElement)) throw new Error(`No tile for ${title}`);
  return card;
}

describe("PaymentsTab KPIs", () => {
  it("shows a count, amount and weekly chart for each payment type", () => {
    renderTab();

    expect(tile("Payments")).toHaveTextContent("1");
    expect(tile("Payments")).toHaveTextContent("$85.00");
    expect(tile("Full Membership")).toHaveTextContent("1");
    expect(tile("Handicap Only")).toHaveTextContent("0");
    expect(tile("Donations")).toHaveTextContent("0");
    for (const title of [
      "Payments",
      "Full Membership",
      "Handicap Only",
      "Donations",
    ]) {
      expect(screen.getByLabelText(`${title} by week`)).toBeInTheDocument();
    }
  });

  it("steps through payment years", () => {
    renderTab();

    const yearField = screen.getByRole("textbox", { name: "Payment year" });
    expect(yearField).toHaveValue(String(year));

    fireEvent.click(screen.getByRole("button", { name: /Decrease/ }));
    expect(yearField).toHaveValue(String(year - 1));

    fireEvent.click(screen.getByRole("button", { name: /Increase/ }));
    fireEvent.click(screen.getByRole("button", { name: /Increase/ }));
    expect(yearField).toHaveValue(String(year + 1));
    // No payments are taken further out than next year.
    expect(screen.getByRole("button", { name: /Increase/ })).toBeDisabled();
  });

  it("filters the paid members list by type", () => {
    renderTab();

    const filters = screen.getByRole("radiogroup", { name: "Filter payments" });
    expect(filters).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(screen.queryByText("No payments found.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Handicap" }));
    expect(screen.getByRole("radio", { name: "Handicap" })).toBeChecked();
    expect(screen.getAllByText("No payments found.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("radio", { name: "Full" }));
    expect(screen.queryByText("No payments found.")).not.toBeInTheDocument();
  });
});
