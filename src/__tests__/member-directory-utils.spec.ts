import { describe, it, expect } from "vitest";

import type { User } from "@/api/users";
import {
  DIRECTORY_FILTER,
  filterMembers,
  groupMembersByLetter,
  memberMatchesSearch,
  membershipSummary,
  membershipTag,
  telHref,
} from "@/utils/memberDirectory";

const u = (id: string, extra: Partial<User> = {}): User => ({ id, ...extra });

describe("groupMembersByLetter", () => {
  it("sorts by last name and groups by its first letter, # last", () => {
    const sections = groupMembersByLetter([
      u("1", { firstName: "Pat", lastName: "Collins", displayName: "Pat Collins" }),
      u("2", { displayName: "Bill Baxter" }),
      u("3", { firstName: "Tom", lastName: "abbott", displayName: "Tom abbott" }),
      u("4", { displayName: "Dana Brooks" }),
      u("5", { email: "123@test.local" }),
    ]);
    expect(sections.map((s) => s.letter)).toEqual(["A", "B", "C", "#"]);
    expect(sections[1].members.map((m) => m.id)).toEqual(["2", "4"]);
  });
});

describe("memberMatchesSearch", () => {
  const member = u("1", {
    displayName: "Dana Brooks",
    email: "dbrooks@test.local",
    phone: "(203) 555-0114",
  });

  it("matches name, email and phone digits", () => {
    expect(memberMatchesSearch(member, "brooks")).toBe(true);
    expect(memberMatchesSearch(member, "DBROOKS@")).toBe(true);
    expect(memberMatchesSearch(member, "555-01")).toBe(true);
    expect(memberMatchesSearch(member, "2035550114")).toBe(true);
  });

  it("ignores phone matches shorter than 3 digits", () => {
    expect(memberMatchesSearch(member, "01")).toBe(false);
  });
});

describe("filterMembers", () => {
  const members = [
    u("a", { displayName: "Ann", boardMember: true }),
    u("b", { displayName: "Bob" }),
  ];

  it("narrows to board members or active members", () => {
    const activeSet = new Set(["b"]);
    expect(
      filterMembers(members, { query: "", filter: DIRECTORY_FILTER.BOARD, activeSet }).map((m) => m.id),
    ).toEqual(["a"]);
    expect(
      filterMembers(members, { query: "", filter: DIRECTORY_FILTER.ACTIVE, activeSet }).map((m) => m.id),
    ).toEqual(["b"]);
    expect(
      filterMembers(members, { query: "", filter: DIRECTORY_FILTER.ALL, activeSet }),
    ).toHaveLength(2);
  });
});

describe("membership labels", () => {
  it("summarizes type and payment for admins", () => {
    expect(membershipSummary(u("1", { membershipType: "full", lastPaidYear: 2026 }), 2026)).toBe(
      "Full, paid 2026",
    );
    expect(
      membershipSummary(u("1", { membershipType: "handicap", lastPaidYear: 2024 }), 2026),
    ).toBe("Handicap only, last paid 2024");
    expect(membershipSummary(u("1"), 2026)).toBe("No membership type, never paid");
  });

  it("tags only members who need attention", () => {
    expect(membershipTag(u("1", { membershipType: "full", lastPaidYear: 2026 }), 2026)).toBeNull();
    expect(membershipTag(u("1", { membershipType: "handicap", lastPaidYear: 2026 }), 2026)).toBe(
      "Handicap",
    );
    expect(membershipTag(u("1", { membershipType: "full", lastPaidYear: 2025 }), 2026)).toBe(
      "Unpaid 2026",
    );
  });
});

describe("telHref", () => {
  it("builds a digits-only tel link", () => {
    expect(telHref("(203) 555-0114")).toBe("tel:2035550114");
    expect(telHref("")).toBe("");
  });
});
