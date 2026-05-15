import type { UserProfilePayload } from "@/api/users";

/**
 * Splits a display name (e.g. from Google Auth) into first and last name parts.
 * "Jane Doe Smith" → { firstName: "Jane", lastName: "Doe Smith" }
 */
export function parseDisplayName(displayName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = parts;
  return { firstName: first ?? "", lastName: rest.join(" ") };
}

export function isProfileComplete(
  profile: UserProfilePayload | null | undefined,
) {
  const first = (profile?.firstName ?? "").trim();
  const last = (profile?.lastName ?? "").trim();
  return Boolean(first && last);
}
