import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import RegistrationEditor from "@/components/registration-editor";

// Minimal mock users list that will change between renders
const initialUsers = [
  { id: "user-a", displayName: "Alice" },
  { id: "user-b", displayName: "Bob" },
] as any[];

const reducedUsers = [{ id: "user-a", displayName: "Alice" }];

function Wrapper({ users, value, onChange }: any) {
  return (
    <RegistrationEditor
      value={value}
      onChange={onChange}
      users={users}
      maxSize={4}
    />
  );
}

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
      />
    );

    // Sanity check both users appear (Alice may appear in trigger + option list)
    expect(screen.getAllByText("Alice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob").length).toBeGreaterThan(0);

    // Rerender with reduced users (Bob removed)
    rerender(
      <Wrapper
        users={reducedUsers}
        value={currentValue}
        onChange={handleChange}
      />
    );

    // Effect runs asynchronously in microtask; flush
    act(() => {});

    // After sanitization, currentValue should only contain user-a
    expect(currentValue).toEqual(["user-a"]);
    // Bob should no longer appear in any rendered option list
    expect(screen.queryByText("Bob")).toBeNull();
  });
});
