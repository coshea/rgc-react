import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
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

// Mock Auth provider hook used by RegistrationEditor
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "test-user", displayName: "Test User" } }),
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
      />
    );

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

    // After sanitization, user-b is cleared but the placeholder slot is preserved.
    expect(currentValue).toEqual(["user-a", ""]);
    // No UI assertion needed here; this test focuses on value sanitization
  });
});
