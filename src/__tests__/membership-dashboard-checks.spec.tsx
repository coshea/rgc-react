import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MembershipDashboardPage from "@/pages/membership-dashboard";

const confirmMembershipPaymentGroupMock = vi.fn();
const addToastMock = vi.fn();

vi.mock("@/hooks/useMembers", () => ({
  useMembers: () => ({
    allMembers: [
      {
        id: "u1",
        displayName: "Alice Member",
        email: "alice@example.com",
      },
      {
        id: "u2",
        displayName: "Bob Check",
        email: "bob@example.com",
      },
    ],
    loading: false,
  }),
}));

vi.mock("@/hooks/useMembershipPayments", () => ({
  useMembershipPayments: () => ({
    isLoading: false,
    data: [
      {
        id: "paypal_dues",
        userId: "u1",
        year: 2026,
        amount: 85,
        method: "paypal",
        membershipType: "full",
        status: "confirmed",
        purpose: "dues",
        groupId: "ORDER123",
        paidAt: { toMillis: () => 1000 },
      },
      {
        id: "paypal_donation",
        userId: "u1",
        year: 2026,
        amount: 20,
        method: "paypal",
        membershipType: "full",
        status: "confirmed",
        purpose: "donation",
        groupId: "ORDER123",
        paidAt: { toMillis: () => 1000 },
      },
      {
        id: "check_dues",
        userId: "u2",
        year: 2026,
        amount: 85,
        method: "check",
        membershipType: "full",
        status: "pending",
        purpose: "dues",
        groupId: "check_u2_2026_req",
      },
      {
        id: "check_donation",
        userId: "u2",
        year: 2026,
        amount: 5,
        method: "check",
        membershipType: "full",
        status: "pending",
        purpose: "donation",
        groupId: "check_u2_2026_req",
      },
    ],
  }),
}));

vi.mock("@/api/membership", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    getMembershipSettings: async () => ({
      fullMembershipPrice: 85,
      handicapMembershipPrice: 50,
    }),
    confirmMembershipPaymentGroup: (args: any) =>
      confirmMembershipPaymentGroupMock(args),
  };
});

vi.mock("@/hooks/usePageTracking", () => ({
  usePageTracking: () => {},
}));

vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    addToast: (args: any) => addToastMock(args),
  };
});

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MembershipDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MembershipDashboard - check payments", () => {
  it("renders pending check payments and confirms them", async () => {
    confirmMembershipPaymentGroupMock.mockResolvedValue({ updated: 2 });

    renderDashboard();

    expect(
      await screen.findByText(/Pending Check Payments/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Bob Check")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mark paid/i }));

    await waitFor(() => {
      expect(confirmMembershipPaymentGroupMock).toHaveBeenCalledWith({
        groupId: "check_u2_2026_req",
        paymentId: undefined,
      });
    });

    expect(addToastMock).toHaveBeenCalled();
  });

  it("shows donation total for confirmed payments", async () => {
    renderDashboard();

    expect(await screen.findByText("Alice Member")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
  });
});
