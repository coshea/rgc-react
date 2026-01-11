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

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "user@example.com" } }),
}));

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    userProfile: { email: "user@example.com", lastName: "User" },
    isLoading: false,
  }),
}));

vi.mock("@/components/membership/hooks", () => ({
  useDocAdminFlag: () => ({ isAdmin: false, loadingAdmin: false }),
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
    </QueryClientProvider>
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
      screen.queryByText(/Step 1: Select option/i)
    ).not.toBeInTheDocument();
  });
});

describe("MembershipPage - new member flow", () => {
  it("shows errors when submitting empty new member application", async () => {
    renderMembershipPage();
    fireEvent.click(
      screen.getByRole("button", { name: /New Member Application/i })
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Submit Application & Pay Dues/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/Full name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Phone number is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Street address is required/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/City, State, ZIP is required/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Please confirm you understand this is an application/i
        )
      ).toBeInTheDocument();
    });

    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("submits successfully with valid application", async () => {
    renderMembershipPage();

    fireEvent.click(
      screen.getByRole("button", { name: /New Member Application/i })
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Golfer" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), {
      target: { value: "(555) 555-5555" },
    });
    fireEvent.change(screen.getByLabelText(/Street Address/i), {
      target: { value: "123 Main St" },
    });
    fireEvent.change(screen.getByLabelText(/City, State, ZIP/i), {
      target: { value: "Ridgefield, CT 06877" },
    });

    fireEvent.click(
      screen.getByText(
        /I understand that this is an application for membership/i
      )
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Submit Application & Pay Dues/i })
    );

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(
        /Application Submitted/i
      );
    });
  });
});

describe("MembershipPage - donation", () => {
  it("requires donation amount", async () => {
    renderMembershipPage();
    fireEvent.click(screen.getByRole("button", { name: /Make a Donation/i }));
    fireEvent.click(screen.getByRole("button", { name: /Make Donation/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Donation amount is required/i)
      ).toBeInTheDocument();
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });
});

describe("MembershipPage - renew", () => {
  it("records a renewal payment", async () => {
    renderMembershipPage();
    fireEvent.click(screen.getByRole("button", { name: /Renew Membership/i }));

    fireEvent.click(screen.getByRole("button", { name: /Pay Annual Dues/i }));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(/Payment Recorded/i);
    });
  });
});
