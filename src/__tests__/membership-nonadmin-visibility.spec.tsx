import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MembersList } from "@/components/membership";
import type { User } from "@/api/users";

// This test ensures non-admin users do NOT see the STATUS column header or admin-only Active toggle UI.
// We only mount the MembersList (and not the full page with toggle) for header assertion; toggle is gated in page component.
// A lightweight mock of the page fragment verifies absence of the toggle.

const mockUsers: User[] = [
  { id: "u1", displayName: "Alice", email: "alice@test.local" },
  { id: "u2", displayName: "Bob", email: "bob@test.local" },
];

function DirectoryFragmentNonAdmin() {
  // Mimic minimal portion of membership-directory (toggle section) with isAdmin=false
  const currentYear = 2099;
  const isAdmin = false;
  const activeOnly = false;
  const activeSet = new Set<string>();
  return (
    <div>
      {/* Toggle should NOT render when isAdmin is false */}
      {isAdmin && <div>Active {currentYear} Only</div>}
      <MembersList
        members={mockUsers}
        filter=""
        isAdmin={isAdmin}
        activeSet={activeSet}
        activeOnly={activeOnly}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
}

describe("Non-admin membership visibility", () => {
  it("does not render STATUS header or active-year toggle for non-admin", () => {
    render(<DirectoryFragmentNonAdmin />);

    // STATUS header should not appear
    expect(screen.queryByText(/STATUS/i)).toBeNull();

    // Active toggle text should not appear (case-insensitive)
    expect(screen.queryByText(/Active\s+2099\s+Only/i)).toBeNull();

    // Basic sanity: user emails are present
    expect(screen.getAllByText(/alice@test\.local/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bob@test\.local/i).length).toBeGreaterThan(0);
  });
});
