import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { EmailIssueBadge } from "@/components/admin-dashboard/email-issue-badge";
import { EMAIL_ISSUE_STATUS, type EmailIssue } from "@@/types";

const clearState = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@/hooks/useEmailIssues", () => ({
  useClearEmailIssue: () => ({ mutate: clearState.mutate, isPending: false }),
}));

const issue: EmailIssue = {
  email: "ann@example.com",
  status: EMAIL_ISSUE_STATUS.BOUNCED,
  reason: "Mailbox does not exist",
  occurredAt: "2026-10-01T12:00:00.000Z",
};

describe("EmailIssueBadge", () => {
  it("shows the issue details when the badge is tapped", async () => {
    render(<EmailIssueBadge issue={issue} />);

    expect(screen.queryByText(/Mailbox does not exist/)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Email bounced: show details" }),
    );

    expect(
      await screen.findByText(/Mailbox does not exist/),
    ).toBeInTheDocument();
  });

  it("clears the issue", () => {
    render(<EmailIssueBadge issue={issue} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear email issue for ann@example.com",
      }),
    );

    expect(clearState.mutate).toHaveBeenCalledWith("ann@example.com");
  });
});
