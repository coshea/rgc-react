import { describe, it, expect } from "vitest";
import { ALLOWED_BOARD_ROLES, isAllowedBoardRole } from "@/types/roles";

describe("Board Roles", () => {
  it("contains expected ordered roles", () => {
    expect(ALLOWED_BOARD_ROLES).toEqual([
      "President",
      "Treasurer",
      "Handicap Chairman",
      "Tournament Chairman",
      "Webmaster",
      "Board Member",
    ]);
  });

  it("validates allowed roles correctly", () => {
    for (const r of ALLOWED_BOARD_ROLES) {
      expect(isAllowedBoardRole(r)).toBe(true);
    }
    expect(isAllowedBoardRole("Secretary")).toBe(false);
    expect(isAllowedBoardRole("")).toBe(false);
    expect(isAllowedBoardRole(undefined as unknown as string)).toBe(false);
  });
});
