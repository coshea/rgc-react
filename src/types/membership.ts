export const MEMBERSHIP_TYPES = {
  FULL: "full",
  HANDICAP: "handicap",
} as const;

export type MembershipType =
  (typeof MEMBERSHIP_TYPES)[keyof typeof MEMBERSHIP_TYPES];
