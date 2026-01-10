import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBoardMembers } from "@/hooks/useBoardMembers";

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      // Real board member
      {
        id: "u1",
        displayName: "President Person",
        email: "pres@example.com",
        boardMember: true,
        role: "President",
      },
      // Not a board member, but has a stray legacy role field (should NOT appear)
      {
        id: "u2",
        displayName: "Stray Role",
        email: "stray@example.com",
        boardMember: false,
        role: "Secretary",
      },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe("useBoardMembers", () => {
  it("includes only users with boardMember === true", () => {
    const { result } = renderHook(() => useBoardMembers());

    expect(result.current.boardMembers.map((m) => m.id)).toEqual(["u1"]);
    expect(result.current.president?.id).toBe("u1");
  });
});
