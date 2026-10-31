import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import { MemberOverviewTab } from "@/components/admin-dashboard/member-overview-tab";
import { PaymentMethodSplit } from "@/components/admin-dashboard/payment-method-split";

const year = new Date().getFullYear();

vi.mock("@/hooks/useMembers", () => ({
  useMembers: () => ({
    allMembers: [
      { id: "u1", displayName: "Alice", membershipType: "full" },
      { id: "u2", displayName: "Bob", membershipType: "full" },
      { id: "u3", displayName: "Cara", membershipType: "handicap" },
      { id: "u4", displayName: "Dan", membershipType: "full" },
    ],
    loading: false,
    activeSet: new Set(["u1", "u2", "u3"]),
  }),
}));

vi.mock("@/hooks/useMembershipPayments", () => ({
  useMembershipPayments: () => ({
    isLoading: false,
    data: [
      { userId: "u1", year, status: "confirmed", method: "paypal" },
      { userId: "u2", year, status: "confirmed", method: "paypal" },
      { userId: "u3", year, status: "confirmed", method: "check" },
      { userId: "u4", year, status: "pending", method: "check" },
    ],
  }),
}));

function tile(title: string) {
  const heading = screen.getByText(title, { selector: "dt" });
  const card = heading.closest('[data-slot="kpi"]');
  if (!(card instanceof HTMLElement)) throw new Error(`No tile for ${title}`);
  return card;
}

describe("PaymentMethodSplit", () => {
  it("shows each method's count and share", () => {
    render(<PaymentMethodSplit check={1} paypal={3} />);

    const methods = within(
      screen.getByRole("list", { name: "Payments by method" }),
    ).getAllByRole("listitem");
    expect(methods[0]).toHaveTextContent("Check125%");
    expect(methods[1]).toHaveTextContent("PayPal375%");
  });

  it("shows 0% for both when there are no payments", () => {
    render(<PaymentMethodSplit check={0} paypal={0} />);

    expect(screen.getAllByText("0%")).toHaveLength(2);
  });
});

describe("MemberOverviewTab KPIs", () => {
  function renderTab() {
    return render(
      <MemoryRouter>
        <MemberOverviewTab />
      </MemoryRouter>,
    );
  }

  it("shows member and membership totals", () => {
    renderTab();

    expect(tile("Total Members")).toHaveTextContent("4");
    expect(tile("Total Members")).toHaveTextContent(
      "3 active (paid last 2 yrs)",
    );
    expect(tile("Memberships")).toHaveTextContent("Full: 3 · Handicap: 1");
  });

  it("compares PayPal and check payments instead of a progress bar", () => {
    renderTab();

    const payments = tile("Payments");
    expect(payments).toHaveTextContent("3");
    expect(payments).toHaveTextContent("Check133%");
    expect(payments).toHaveTextContent("PayPal267%");
    expect(within(payments).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("opens the not-paid list from its tile", () => {
    renderTab();

    const notPaid = tile("Not Paid Yet");
    expect(notPaid).toHaveTextContent("1");
    const button = screen.getByRole("button", {
      name: "Not paid yet: 1. View members",
    });
    // The button covers the tile but must not wrap its dt/dd.
    expect(notPaid).toContainElement(button);
    expect(button.querySelector("dt, dd")).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText("Dan")).toBeInTheDocument();
  });
});
