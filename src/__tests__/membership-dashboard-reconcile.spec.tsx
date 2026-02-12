import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import MembershipDashboardPage from "@/pages/membership-dashboard";

const reconcilePayPalMembershipOrdersMock = vi.fn();
const confirmMembershipPaymentGroupMock = vi.fn();
const addToastMock = vi.fn();

const mockUser = {
  uid: "admin-uid",
  getIdToken: vi.fn(async () => "token"),
};

vi.mock("@/hooks/useMembers", () => ({
  useMembers: () => ({
    allMembers: [],
    loading: false,
  }),
}));

vi.mock("@/hooks/useMembershipPayments", () => ({
  useMembershipPayments: () => ({
    isLoading: false,
    data: [],
  }),
}));

vi.mock("@/api/membership", () => ({
  getMembershipSettings: async () => ({
    fullMembershipPrice: 85,
    handicapMembershipPrice: 50,
  }),
  confirmMembershipPaymentGroup: (args: unknown) =>
    confirmMembershipPaymentGroupMock(args),
  reconcilePayPalMembershipOrders: (args: unknown) =>
    reconcilePayPalMembershipOrdersMock(args),
}));

vi.mock("@/hooks/usePageTracking", () => ({
  usePageTracking: () => {},
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/components/membership/hooks", () => ({
  useDocAdminFlag: () => ({ isAdmin: true, loadingAdmin: false }),
}));

vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MembershipDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { invalidateQueriesSpy };
}

describe("MembershipDashboard - PayPal reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows PayPal Reconciliation card for admins", async () => {
    renderDashboard();

    expect(
      await screen.findByText(/PayPal Reconciliation/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Check PayPal orders/i }),
    ).toBeInTheDocument();
  });

  it("runs reconciliation and shows success toast", async () => {
    const currentYear = new Date().getFullYear();
    reconcilePayPalMembershipOrdersMock.mockResolvedValue({
      ok: true,
      scanned: 7,
      processed: 3,
      skipped: 0,
      skippedItems: [],
      errors: [],
    });

    const { invalidateQueriesSpy } = renderDashboard();

    fireEvent.click(
      await screen.findByRole("button", { name: /Check PayPal orders/i }),
    );

    await waitFor(() => {
      expect(reconcilePayPalMembershipOrdersMock).toHaveBeenCalledWith({
        user: mockUser,
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["membershipPayments", currentYear],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["activeMembers", currentYear],
      });
    });

    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Reconciliation complete",
        description: "Scanned 7, recorded 3.",
        color: "success",
      }),
    );
  });

  it("shows failure toast when reconciliation errors", async () => {
    reconcilePayPalMembershipOrdersMock.mockRejectedValue(
      new Error("Service unavailable"),
    );

    const { invalidateQueriesSpy } = renderDashboard();

    fireEvent.click(
      await screen.findByRole("button", { name: /Check PayPal orders/i }),
    );

    await waitFor(() => {
      expect(reconcilePayPalMembershipOrdersMock).toHaveBeenCalled();
    });

    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Reconciliation failed",
        description: "Service unavailable",
        color: "danger",
      }),
    );
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
