import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditMemberModal } from "@/components/membership/EditMemberModal";
import type { User } from "@/api/users";

// ── Mocks ──────────────────────────────────────────────────────────────────

const addToastMock = vi.fn();

vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

const getMembershipPaymentMock = vi.fn();
const updateMembershipPaymentMock = vi.fn();
const deleteMembershipPaymentMock = vi.fn();

vi.mock("@/api/membership", () => ({
  getMembershipPayment: (...args: unknown[]) =>
    getMembershipPaymentMock(...args),
  updateMembershipPayment: (...args: unknown[]) =>
    updateMembershipPaymentMock(...args),
  deleteMembershipPayment: (...args: unknown[]) =>
    deleteMembershipPaymentMock(...args),
}));

// Stub @iconify/react so jsdom doesn't choke on SVG
vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const mockMember: User = {
  id: "user-abc",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  displayName: "Jane Smith",
};

const existingPayment = {
  id: "pay-1",
  userId: "user-abc",
  year: new Date().getFullYear(),
  status: "confirmed" as const,
  membershipType: "full" as const,
  amount: 175,
  method: "paypal",
  paidAt: null,
  createdAt: null,
};

function renderModal(
  overrides: Partial<Parameters<typeof EditMemberModal>[0]> = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultProps = {
    open: true,
    editing: mockMember,
    form: { firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
    onChange: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue("user-abc"),
    isAdmin: true,
    ...overrides,
  };
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <EditMemberModal {...defaultProps} />
      </QueryClientProvider>,
    ),
    props: defaultProps,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("EditMemberModal – Delete Payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMembershipPaymentMock.mockResolvedValue(existingPayment);
    deleteMembershipPaymentMock.mockResolvedValue(undefined);
  });

  it("shows Delete Payment button when an existing payment is loaded", async () => {
    renderModal();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete payment/i }),
      ).toBeInTheDocument(),
    );
  });

  it("does NOT show Delete Payment button when no payment record exists", async () => {
    getMembershipPaymentMock.mockResolvedValue(null);
    renderModal();

    // loading finishes with no payment
    await waitFor(() => expect(getMembershipPaymentMock).toHaveBeenCalled());

    expect(
      screen.queryByRole("button", { name: /delete payment/i }),
    ).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting – shows Confirm / Cancel buttons", async () => {
    renderModal();

    const deleteBtn = await screen.findByRole("button", {
      name: /delete payment/i,
    });
    fireEvent.click(deleteBtn);

    const confirmSection = await screen.findByText(
      /delete this payment record/i,
    );
    const container = confirmSection.closest("div") as HTMLElement;
    expect(
      within(container).getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
    expect(
      within(container).getByRole("button", { name: /cancel/i }),
    ).toBeInTheDocument();
  });

  it("Cancel hides the confirm prompt without calling deleteMembershipPayment", async () => {
    renderModal();

    const deleteBtn = await screen.findByRole("button", {
      name: /delete payment/i,
    });
    fireEvent.click(deleteBtn);

    const confirmText = await screen.findByText(/delete this payment record/i);
    const container = confirmText.closest("div") as HTMLElement;
    fireEvent.click(within(container).getByRole("button", { name: /cancel/i }));

    // Confirm prompt gone, original button restored
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /delete payment/i }),
      ).toBeInTheDocument(),
    );
    expect(deleteMembershipPaymentMock).not.toHaveBeenCalled();
  });

  it("calls deleteMembershipPayment with correct userId and year on Confirm", async () => {
    renderModal();

    fireEvent.click(
      await screen.findByRole("button", { name: /delete payment/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(deleteMembershipPaymentMock).toHaveBeenCalledTimes(1),
    );
    expect(deleteMembershipPaymentMock).toHaveBeenCalledWith({
      userId: "user-abc",
      year: new Date().getFullYear(),
    });
  });

  it("shows a success toast after successful deletion", async () => {
    renderModal();

    fireEvent.click(
      await screen.findByRole("button", { name: /delete payment/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Payment deleted", color: "success" }),
      ),
    );
  });

  it("shows an error toast when deleteMembershipPayment rejects", async () => {
    deleteMembershipPaymentMock.mockRejectedValue(new Error("Firestore error"));
    renderModal();

    fireEvent.click(
      await screen.findByRole("button", { name: /delete payment/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Delete failed", color: "danger" }),
      ),
    );
  });

  it("does not show the payment section for non-admin users", async () => {
    renderModal({ isAdmin: false });

    // Payment section heading should not appear
    expect(screen.queryByText(/membership payment/i)).not.toBeInTheDocument();
  });
});
