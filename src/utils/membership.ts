import type { User } from "@/api/users";

/**
 * Returns true if the user is a full member and has paid for the specified year (defaults to current year).
 * Used to gate tournament registration for the current authenticated user.
 */
export function isActiveFullMember(
  u: User | undefined,
  year: number = new Date().getFullYear()
): u is User & { membershipType: "full" } {
  return !!u && u.membershipType === "full" && (u.lastPaidYear ?? 0) >= year;
}

/**
 * Simple full membership check (does not consider lastPaidYear). Useful for teammate selection filters.
 */
export function isFullMember(
  u: User | undefined
): u is User & { membershipType: "full" } {
  return !!u && u.membershipType === "full";
}
