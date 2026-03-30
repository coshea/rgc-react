import { describe, it, expect } from "vitest";
import type { User } from "@/api/users";
import { getEmailAddresses } from "@/components/membership/EmailMembersButton";

const CURRENT_YEAR = 2026;
const PREV_YEAR = 2025;

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    email: `${overrides.id}@test.local`,
    ...overrides,
  } as User;
}

const users: User[] = [
  makeUser({
    id: "a",
    email: "a@test.local",
    membershipType: "full",
    lastPaidYear: CURRENT_YEAR,
  }),
  makeUser({
    id: "b",
    email: "b@test.local",
    membershipType: "handicap",
    lastPaidYear: CURRENT_YEAR,
  }),
  makeUser({
    id: "c",
    email: "c@test.local",
    membershipType: "full",
    lastPaidYear: PREV_YEAR,
  }),
  makeUser({
    id: "d",
    email: "d@test.local",
    membershipType: "full",
    lastPaidYear: PREV_YEAR - 1,
  }),
  makeUser({
    id: "e",
    email: "e@test.local",
    membershipType: "full",
    lastPaidYear: CURRENT_YEAR,
  }),
  makeUser({ id: "f", email: "" }), // no email
];

// activeSet = paid within last 2 years (>= PREV_YEAR)
const activeSet = new Set(["a", "b", "c", "e"]);

describe("getEmailAddresses", () => {
  describe("full-members-this-year", () => {
    it("returns only full members who paid this year", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "full-members-this-year",
        CURRENT_YEAR,
      );
      expect(result).toEqual(
        expect.arrayContaining(["a@test.local", "e@test.local"]),
      );
      expect(result).toHaveLength(2);
    });

    it("excludes handicap members even if paid this year", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "full-members-this-year",
        CURRENT_YEAR,
      );
      expect(result).not.toContain("b@test.local");
    });

    it("excludes full members who paid in a prior year", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "full-members-this-year",
        CURRENT_YEAR,
      );
      expect(result).not.toContain("c@test.local");
      expect(result).not.toContain("d@test.local");
    });

    it("excludes members without an email", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "full-members-this-year",
        CURRENT_YEAR,
      );
      expect(result.some((e) => !e)).toBe(false);
    });
  });

  describe("paid-this-year", () => {
    it("returns all members (any type) who paid this year", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "paid-this-year",
        CURRENT_YEAR,
      );
      expect(result).toEqual(
        expect.arrayContaining([
          "a@test.local",
          "b@test.local",
          "e@test.local",
        ]),
      );
      expect(result).toHaveLength(3);
    });

    it("excludes members who paid in prior years", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "paid-this-year",
        CURRENT_YEAR,
      );
      expect(result).not.toContain("c@test.local");
      expect(result).not.toContain("d@test.local");
    });
  });

  describe("active-last-2-years", () => {
    it("returns all members in the activeSet", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "active-last-2-years",
        CURRENT_YEAR,
      );
      expect(result).toEqual(
        expect.arrayContaining([
          "a@test.local",
          "b@test.local",
          "c@test.local",
          "e@test.local",
        ]),
      );
      expect(result).toHaveLength(4);
    });

    it("excludes members not in activeSet", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "active-last-2-years",
        CURRENT_YEAR,
      );
      expect(result).not.toContain("d@test.local");
    });
  });

  describe("all", () => {
    it("returns every member with an email address", () => {
      const result = getEmailAddresses(users, activeSet, "all", CURRENT_YEAR);
      expect(result).toEqual(
        expect.arrayContaining([
          "a@test.local",
          "b@test.local",
          "c@test.local",
          "d@test.local",
          "e@test.local",
        ]),
      );
      expect(result).toHaveLength(5);
    });

    it("excludes members with no email", () => {
      const noEmail = makeUser({ id: "g", email: "" });
      const result = getEmailAddresses(
        [...users, noEmail],
        activeSet,
        "all",
        CURRENT_YEAR,
      );
      expect(result.some((e) => e === "")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns empty array when member list is empty", () => {
      expect(getEmailAddresses([], new Set(), "all", CURRENT_YEAR)).toEqual([]);
    });

    it("returns empty array when no members match a scope", () => {
      const result = getEmailAddresses(
        users,
        activeSet,
        "full-members-this-year",
        1990,
      );
      expect(result).toEqual([]);
    });
  });
});
