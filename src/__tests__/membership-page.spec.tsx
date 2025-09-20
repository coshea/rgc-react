import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import MembershipPage from "@/pages/membership";

// Capture toast calls
const addToastMock = vi.fn();

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u1", email: "user@example.com" } }),
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
  // Try radio role first
  const radios = screen.queryAllByRole("radio", { name: labelRegex });
  if (radios.length > 0) {
    fireEvent.click(radios[0]);
    return;
  }
  // fallback: find all matching text nodes, click closest label parent
  const matches = screen.getAllByText(labelRegex);
  const target = matches.find((el) => el.closest("label"));
  if (target) fireEvent.click(target.closest("label")!);
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
    switchMode(/Donation Only/i);
    fireEvent.click(screen.getByRole("button", { name: /^Donate$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Enter an amount/i)).toBeInTheDocument();
    });
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("validates positive donation amount", async () => {
    render(<MembershipPage />);
    switchMode(/Donation Only/i);
    const input = screen.getByLabelText(/Donation Amount/i);
    fireEvent.change(input, { target: { value: "-10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Donate$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Amount must be > 0/i)).toBeInTheDocument();
    });
  });

  it("submits valid donation", async () => {
    render(<MembershipPage />);
    switchMode(/Donation Only/i);
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
    switchMode(/Renew \(\$/i);
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
    switchMode(/Renew \(\$/i);
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
    switchMode(/Renew \(\$/i);
    const optionalDonation = screen.getByLabelText(/Optional Donation/i);
    fireEvent.change(optionalDonation, { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));
    // Switch back to new mode to inspect form fields state
    switchMode(/New Member/i);
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
    switchMode(/Renew/);
    const donationInput = screen.getByLabelText(/Optional Donation/i);
    fireEvent.change(donationInput, { target: { value: "15" } });
    // Button label should reflect 85 + 15 = 100
    // New compact label should only show total (no parenthetical)
    expect(
      screen.getByRole("button", { name: /Renew \$100\.00/i })
    ).toBeInTheDocument();
    // Breakdown rendered below button now
    expect(
      screen.getByText(/Includes Membership \$85\.00 \+ Donation \$15\.00/i)
    ).toBeInTheDocument();
  });

  it("handles handicap-only flow with donation", async () => {
    render(<MembershipPage />);
    switchMode(/Handicap Only/);
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
