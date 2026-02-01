import type { UserProfilePayload } from "@/api/users";

export function isProfileComplete(
  profile: UserProfilePayload | null | undefined,
) {
  const first = (profile?.firstName ?? "").trim();
  const last = (profile?.lastName ?? "").trim();
  return Boolean(first && last);
}
