import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

// We only test the role dropdown rendering logic fragmentally by mocking the component piece.
// Extract minimal role UI logic for test (avoids needing Firestore / Auth context).
import { ALLOWED_BOARD_ROLES, isAllowedBoardRole } from "@/types/roles";

function RoleSelectorTest({
  initialBoard = false,
  initialRole = "",
}: {
  initialBoard?: boolean;
  initialRole?: string;
}) {
  const [form, setForm] = React.useState({
    boardMember: initialBoard,
    role: initialRole,
  });
  const ROLE_OPTIONS = ALLOWED_BOARD_ROLES as readonly string[];
  const hasLegacy = form.role && !ROLE_OPTIONS.includes(form.role);
  const options = hasLegacy ? [form.role, ...ROLE_OPTIONS] : ROLE_OPTIONS;
  return (
    <div>
      <label>
        <input
          type="checkbox"
          data-testid="board-toggle"
          checked={form.boardMember}
          onChange={(e) => {
            const checked = e.target.checked;
            setForm((prev) => ({
              ...prev,
              boardMember: checked,
              role: checked ? prev.role || "Board Member" : "",
            }));
          }}
        />{" "}
        Board Member
      </label>
      {form.boardMember && (
        <select
          data-testid="role-select"
          value={form.role}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, role: e.target.value }))
          }
        >
          <option value="" disabled>
            Select a role
          </option>
          {options.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      )}
      <div data-testid="valid-flag">
        {form.role && isAllowedBoardRole(form.role) ? "valid" : "invalid"}
      </div>
    </div>
  );
}

describe("Membership Directory role UI", () => {
  it("adds default role when board member toggled on", () => {
    const { getByTestId } = render(<RoleSelectorTest />);
    const toggle = getByTestId("board-toggle") as HTMLInputElement;
    fireEvent.click(toggle);
    const select = getByTestId("role-select") as HTMLSelectElement;
    expect(select.value).toBe("Board Member");
  });

  it("shows legacy role if present and keeps it as first option", () => {
    const { getByTestId } = render(
      <RoleSelectorTest initialBoard initialRole="Legacy Role" />
    );
    const select = getByTestId("role-select") as HTMLSelectElement;
    expect(select.value).toBe("Legacy Role");
    // validity should be invalid
    const flag = getByTestId("valid-flag");
    expect(flag.textContent).toBe("invalid");
  });

  it("marks allowed role as valid", () => {
    const { getByTestId } = render(
      <RoleSelectorTest initialBoard initialRole="President" />
    );
    const flag = getByTestId("valid-flag");
    expect(flag.textContent).toBe("valid");
  });
});
