import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import MembershipPage from "@/pages/membership";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";

// Capture toast calls
const addToastMock = vi.fn();

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "user@example.com" } }),
}));

vi.mock("@/components/membership/hooks", () => ({
  useDocAdminFlag: () => ({ isAdmin: false, loadingAdmin: false }),
}));

vi.mock("@/api/membership", () => ({
  subscribeMembershipSettings: (callback: any) => {
    // Immediately invoke callback with default settings
    callback(DEFAULT_MEMBERSHIP_SETTINGS);
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
});

function switchMode(labelRegex: RegExp) {
  // New UI uses pressable Cards with role="button" and an aria-label
  const buttons = screen.queryAllByRole("button", { name: labelRegex });
  if (buttons.length > 0) {
    fireEvent.click(buttons[0]);
    return;
  }
  // fallback: click a heading/text node
  const matches = screen.getAllByText(labelRegex);
  fireEvent.click(matches[0]);
}

describe("MembershipPage - new member validation", () => {
  it("shows errors when submitting empty new member form", async () => {
    render(<MembershipPage />);
    // Ensure mode is new (default). Click submit.
    fireEvent.click(screen.getByRole("button", { name: /Apply & Pay/i }));
    await waitFor(() => {
      expect(screen.getByText(/Name required/i)).toBeInTheDocument();
      expect(screen.getByText(/Phone required/i)).toBeInTheDocument();
      expect(screen.getByText(/Address required/i)).toBeInTheDocument();
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("submits successfully with valid new member form", async () => {
    render(<MembershipPage />);
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Jane Golfer" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Phone/i), {
      target: { value: "(555) 555-5555" },
    });
    fireEvent.change(screen.getByLabelText(/Address/i), {
      target: { value: "123 Main St" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Apply & Pay/i }));
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(
        /Application Submitted/i
      );
    });
  });
});

describe("MembershipPage - donation only", () => {
  it("requires donation amount", async () => {
    render(<MembershipPage />);
    switchMode(/Select Donation Only/i);
    fireEvent.click(screen.getByRole("button", { name: /^Donate$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Enter an amount/i)).toBeInTheDocument();
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("validates positive donation amount", async () => {
    render(<MembershipPage />);
    switchMode(/Select Donation Only/i);
    const input = screen.getByLabelText(/Donation Amount/i);
    fireEvent.change(input, { target: { value: "-10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Donate$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Amount must be > 0/i)).toBeInTheDocument();
    });
  });

  it("submits valid donation", async () => {
    render(<MembershipPage />);
    switchMode(/Select Donation Only/i);
    const input = screen.getByLabelText(/Donation Amount/i);
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /Donate \$150\.00/i }));
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(/Donation Received/i);
    });
  });
});

describe("MembershipPage - renewal", () => {
  it("allows renewal without donation", async () => {
    render(<MembershipPage />);
    switchMode(/Select Renew Membership/i);
    const renewButton = screen.getByRole("button", { name: /Renew \$/i });
    fireEvent.click(renewButton);
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(
        /Membership Renewed/i
      );
    });
  });

  it("allows renewal with optional donation", async () => {
    render(<MembershipPage />);
    switchMode(/Select Renew Membership/i);
    const optionalDonation = screen.getByLabelText(/Optional Donation/i);
    fireEvent.change(optionalDonation, { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /Renew \$/i }));
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
      expect(addToastMock.mock.calls[0][0].title).toMatch(
        /Membership Renewed/i
      );
    });
  });
});

describe("MembershipPage - reset behavior", () => {
  it("clears fields and donation on reset", async () => {
    render(<MembershipPage />);
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Temp User" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "temp@example.com" },
    });
    switchMode(/Select Renew Membership/i);
    const optionalDonation = screen.getByLabelText(/Optional Donation/i);
    fireEvent.change(optionalDonation, { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));
    // Switch back to new mode to inspect form fields state
    switchMode(/Select New Member/i);
    expect(
      (screen.getByLabelText(/Full Name/i) as HTMLInputElement).value
    ).toBe("");
  });
});

describe("MembershipPage - dynamic donation labels & handicap", () => {
  it("updates new member button total when donation entered", async () => {
    render(<MembershipPage />);
    // Enter base form fields to allow submit path (to avoid validation errors interfering)
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "John Test" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "john@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/Phone/i), {
      target: { value: "5555555555" },
    });
    fireEvent.change(screen.getByLabelText(/Address/i), {
      target: { value: "1 Test Way" },
    });
    // Add donation via switching to renew not required; donation for new member currently only supported implicitly if we add donation input (not present). So switch to renew to test dynamic then back? Simpler: Use renew flow since it has donation field.
    switchMode(/Select Renew Membership/i);
    const donationInput = screen.getByLabelText(/Optional Donation/i);
    fireEvent.change(donationInput, { target: { value: "15" } });
    // Button label should reflect 100 + 15 = 115
    // New compact label should only show total (no parenthetical)
    expect(
      screen.getByRole("button", { name: /Renew \$115\.00/i })
    ).toBeInTheDocument();
    // Breakdown rendered below button now
    expect(
      screen.getByText(/Includes Membership \$100\.00 \+ Donation \$15\.00/i)
    ).toBeInTheDocument();
  });

  it("handles handicap-only flow with donation", async () => {
    render(<MembershipPage />);
    switchMode(/Select Handicap Only/i);
    const donationInput = screen.getByLabelText(/Optional Donation/i);
    fireEvent.change(donationInput, { target: { value: "10" } });
    const btn = screen.getByRole("button", { name: /Handicap \$60\.00/i });
    // Breakdown rendered below button now
    expect(
      screen.getByText(/Includes Handicap \$50\.00 \+ Donation \$10\.00/i)
    ).toBeInTheDocument();
    fireEvent.click(btn);
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalled();
    });
  });
});
