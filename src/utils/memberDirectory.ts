import type { User } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";
import { normalizePhone } from "@/utils/phone";

/** Filter chips above the directory list. `ACTIVE` is admin-only. */
export const DIRECTORY_FILTER = {
  ALL: "all",
  BOARD: "board",
  ACTIVE: "active",
} as const;

export type DirectoryFilter =
  (typeof DIRECTORY_FILTER)[keyof typeof DIRECTORY_FILTER];

export function isDirectoryFilter(value: unknown): value is DirectoryFilter {
  return Object.values(DIRECTORY_FILTER).some((f) => f === value);
}

/** Section key for names that don't start with A–Z. */
export const OTHER_LETTER = "#";

export interface MemberSection {
  letter: string;
  members: User[];
}

export function memberName(u: User): string {
  return (
    u.displayName ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.email ||
    "(no name)"
  );
}

/** Last name for phone-book ordering, falling back to the last word of the name. */
function lastNameOf(u: User): string {
  return u.lastName?.trim() || memberName(u).trim().split(/\s+/).pop() || "";
}

export function memberLetter(u: User): string {
  const first = lastNameOf(u).charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : OTHER_LETTER;
}

export function telHref(phone?: string | null): string {
  const digits = normalizePhone(phone);
  return digits ? `tel:${digits}` : "";
}

/** Matches name or email, or the phone number when the query has 3+ digits. */
export function memberMatchesSearch(u: User, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (memberName(u).toLowerCase().includes(q)) return true;
  if ((u.email ?? "").toLowerCase().includes(q)) return true;
  const digits = normalizePhone(q);
  return digits.length >= 3 && normalizePhone(u.phone).includes(digits);
}

export function filterMembers(
  members: User[],
  {
    query,
    filter,
    activeSet,
  }: { query: string; filter: DirectoryFilter; activeSet: Set<string> },
): User[] {
  return members.filter((m) => {
    if (filter === DIRECTORY_FILTER.BOARD && !m.boardMember) return false;
    if (filter === DIRECTORY_FILTER.ACTIVE && !activeSet.has(m.id))
      return false;
    return memberMatchesSearch(m, query);
  });
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

/** Sorts by last name, then full name, and groups by the last name's first letter. */
export function groupMembersByLetter(members: User[]): MemberSection[] {
  const sorted = [...members].sort(
    (a, b) =>
      collator.compare(lastNameOf(a), lastNameOf(b)) ||
      collator.compare(memberName(a), memberName(b)),
  );
  const sections = new Map<string, User[]>();
  for (const m of sorted) {
    const letter = memberLetter(m);
    const list = sections.get(letter);
    if (list) list.push(m);
    else sections.set(letter, [m]);
  }
  return [...sections.entries()]
    .sort(([a], [b]) =>
      a === OTHER_LETTER ? 1 : b === OTHER_LETTER ? -1 : a.localeCompare(b),
    )
    .map(([letter, list]) => ({ letter, members: list }));
}

function membershipTypeLabel(u: User): string | null {
  if (u.membershipType === MEMBERSHIP_TYPES.FULL) return "Full";
  if (u.membershipType === MEMBERSHIP_TYPES.HANDICAP) return "Handicap only";
  return null;
}

/** Admin summary, e.g. "Full, paid 2026" or "Handicap only, last paid 2024". */
export function membershipSummary(u: User, year: number): string {
  const type = membershipTypeLabel(u) ?? "No membership type";
  const paid =
    typeof u.lastPaidYear !== "number"
      ? "never paid"
      : u.lastPaidYear >= year
        ? `paid ${year}`
        : `last paid ${u.lastPaidYear}`;
  return `${type}, ${paid}`;
}

/** Short admin tag for the desktop list; null for a paid-up full member. */
export function membershipTag(u: User, year: number): string | null {
  if ((u.lastPaidYear ?? 0) < year) return `Unpaid ${year}`;
  if (u.membershipType === MEMBERSHIP_TYPES.HANDICAP) return "Handicap";
  return null;
}
