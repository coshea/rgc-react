import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MembershipPage from "@/pages/membership";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";

// Capture toast calls
const addToastMock = vi.fn();

let mockedSettings = DEFAULT_MEMBERSHIP_SETTINGS;
let mockedUser: { uid: string; email: string } | null = {
  uid: "u1",
  email: "user@example.com",
};

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: mockedUser }),
}));

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    userProfile: { email: "user@example.com", lastName: "User" },
    isLoading: false,
  }),
}));

vi.mock("@/components/membership/hooks", () => ({
  useAdminFlag: () => ({ isAdmin: false, loadingAdmin: false }),
  useBoardMemberFlag: () => ({ isBoardMember: false, loadingBoard: false }),
}));

vi.mock("@/api/membership", () => ({
  subscribeMembershipSettings: (callback: any) => {
    // Immediately invoke callback with whatever the test has configured
    callback(mockedSettings);
    return () => {}; // unsubscribe function
  },
}));

vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    addToast: (args: any) => addToastMock(args),
  };
});

beforeEach(() => {
  addToastMock.mockClear();
  mockedSettings = DEFAULT_MEMBERSHIP_SETTINGS;
  mockedUser = { uid: "u1", email: "user@example.com" };
});

function renderMembershipPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <MembershipPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MembershipPage - registration closed gating", () => {
  it("shows registration closed message when registrationOpen is false", async () => {
    mockedSettings = {
      ...DEFAULT_MEMBERSHIP_SETTINGS,
      registrationOpen: false,
      closedMessage: "Closed for testing",
    };

    renderMembershipPage();

    expect(screen.getByText(/Registration Closed/i)).toBeInTheDocument();
    expect(screen.getByText(/Closed for testing/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Step 1: Select option/i),
    ).not.toBeInTheDocument();
  });
});

describe("MembershipPage - new member flow", () => {
  it("shows errors when submitting empty new member application", async () => {
    renderMembershipPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /^Join for 2026$/i }),
    );

    // Step 2
    fireEvent.click(
      await screen.findByRole("button", { name: /Apply & Pay Dues/i }),
    );

    // Step 3
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Continue to Payment/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/The application PDF has not been configured yet/i),
      ).toBeInTheDocument();
    });

    const continueButton = screen.getByRole("button", {
      name: /Continue to Payment/i,
    });
    expect(continueButton).toBeDisabled();

    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("submits successfully with valid application", async () => {
    mockedSettings = {
      ...DEFAULT_MEMBERSHIP_SETTINGS,
      membershipApplicationUrl: "https://storage.test/public-docs/app.pdf",
    };
    renderMembershipPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /^Join for 2026$/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Apply & Pay Dues/i }),
    );

    fireEvent.click(
      screen.getByText(/I understand I must mail the completed application/i),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Continue to Payment/i }),
    );

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(/Payment Recorded/i);
    });
  });
});

describe("MembershipPage - donation", () => {
  it("requires donation amount", async () => {
    renderMembershipPage();
    fireEvent.click(screen.getByRole("button", { name: /Donate/i }));
    fireEvent.click(screen.getByRole("button", { name: /Make Donation/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Donation amount is required/i),
      ).toBeInTheDocument();
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });
});

describe("MembershipPage - renew", () => {
  it("records a renewal payment", async () => {
    renderMembershipPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /^Join for 2026$/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Continue$/i }));

    fireEvent.click(
      await screen.findByRole("button", { name: /Pay Annual Dues/i }),
    );

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(/Payment Recorded/i);
    });
  });
});

describe("MembershipPage - unauthenticated user", () => {
  it("shows login-required toast when unauthenticated user clicks Join for current year", async () => {
    mockedUser = null;
    renderMembershipPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /^Join for \d{4}$/i }),
    );

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].color).toBe("warning");
      expect(addToastMock.mock.calls[0][0].title).toMatch(/Login required/i);
    });

    // Should NOT have advanced to the annual_start step
    expect(
      screen.queryByText(/Step 2: Confirm details/i),
    ).not.toBeInTheDocument();
  });
});
