import { describe, it, expect, vi } from "vitest";
import { render, act, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import RegistrationEditor from "@/components/registration-editor";

// Minimal mock users list that will change between renders
const initialUsers = [
  { id: "user-a", displayName: "Alice" },
  { id: "user-b", displayName: "Bob" },
] as any[];

const reducedUsers = [{ id: "user-a", displayName: "Alice" }];

function Wrapper({ users, value, onChange, goldTees, onGoldTeesChange }: any) {
  return (
    <RegistrationEditor
      value={value}
      onChange={onChange}
      users={users}
      maxSize={4}
      goldTees={goldTees}
      onGoldTeesChange={onGoldTeesChange}
    />
  );
}

// Mock Auth provider hook used by RegistrationEditor
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "test-user", displayName: "Test User" } }),
}));

// Lightweight UserSelect mock so we can control rendered value without HeroUI Select overhead
vi.mock("@/components/UserSelect", () => ({
  __esModule: true,
  UserSelect: ({ value, onChange, label }: any) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select player</option>
        <option value="user-a">Alice</option>
        <option value="user-b">Bob</option>
      </select>
    </label>
  ),
}));

describe("RegistrationEditor selectedKeys sanitization", () => {
  it("drops stale user ids when user list shrinks", () => {
    let currentValue: string[] = ["user-a", "user-b"];
    const handleChange = (ids: string[]) => {
      currentValue = ids;
    };

    const { rerender } = render(
      <Wrapper
        users={initialUsers}
        value={currentValue}
        onChange={handleChange}
      />,
    );

    // Rerender with reduced users (Bob removed)
    rerender(
      <Wrapper
        users={reducedUsers}
        value={currentValue}
        onChange={handleChange}
      />,
    );

    // Effect runs asynchronously in microtask; flush
    act(() => {});

    // After sanitization, user-b is cleared but the placeholder slot is preserved.
    expect(currentValue).toEqual(["user-a", ""]);
    // No UI assertion needed here; this test focuses on value sanitization
  });
});

describe("RegistrationEditor gold tee toggle", () => {
  it("does not show gold tee buttons when onGoldTeesChange is not provided", () => {
    render(
      <Wrapper users={initialUsers} value={["user-a"]} onChange={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: /gold tee/i })).toBeNull();
  });

  it("shows gold tee button for each filled slot when onGoldTeesChange is provided", () => {
    render(
      <Wrapper
        users={initialUsers}
        value={["user-a", "user-b"]}
        onChange={() => {}}
        goldTees={[]}
        onGoldTeesChange={() => {}}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /gold tee/i });
    expect(buttons).toHaveLength(2);
    // Both should be in "Add" state when goldTees is empty
    expect(buttons[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Add"),
    );
    expect(buttons[1]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Add"),
    );
  });

  it("renders as active (Remove label) when uid is in goldTees", () => {
    render(
      <Wrapper
        users={initialUsers}
        value={["user-a", "user-b"]}
        onChange={() => {}}
        goldTees={["user-b"]}
        onGoldTeesChange={() => {}}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /gold tee/i });
    expect(buttons[0]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Add"),
    ); // user-a inactive
    expect(buttons[1]).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Remove"),
    ); // user-b active
  });

  it("calls onGoldTeesChange with added uid when pressed", () => {
    const onGoldTeesChange = vi.fn();
    render(
      <Wrapper
        users={initialUsers}
        value={["user-a", "user-b"]}
        onChange={() => {}}
        goldTees={[]}
        onGoldTeesChange={onGoldTeesChange}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /gold tee/i });
    fireEvent.click(buttons[0]); // add user-a
    expect(onGoldTeesChange).toHaveBeenCalledWith(["user-a"]);
  });

  it("calls onGoldTeesChange with uid removed when pressed again", () => {
    const onGoldTeesChange = vi.fn();
    render(
      <Wrapper
        users={initialUsers}
        value={["user-a", "user-b"]}
        onChange={() => {}}
        goldTees={["user-a"]}
        onGoldTeesChange={onGoldTeesChange}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /gold tee/i });
    fireEvent.click(buttons[0]); // remove user-a
    expect(onGoldTeesChange).toHaveBeenCalledWith([]);
  });

  it("does not show gold tee button for empty (unselected) slots", () => {
    render(
      <Wrapper
        users={initialUsers}
        value={["user-a", ""]}
        onChange={() => {}}
        goldTees={[]}
        onGoldTeesChange={() => {}}
      />,
    );
    // Only the filled slot (user-a) should have a button
    const buttons = screen.getAllByRole("button", { name: /gold tee/i });
    expect(buttons).toHaveLength(1);
  });
});
