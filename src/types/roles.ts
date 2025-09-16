// Central definition of allowed board roles and ordering/metadata
export const ALLOWED_BOARD_ROLES = [
  "President",
  "Treasurer",
  "Handicap Chairman",
  "Webmaster",
  "Board Member",
] as const;

export type BoardRole = (typeof ALLOWED_BOARD_ROLES)[number];

export const ROLE_PRIORITY: Record<BoardRole, number> = {
  President: 1,
  Treasurer: 2,
  "Handicap Chairman": 3,
  Webmaster: 4,
  "Board Member": 5,
};

export function isAllowedBoardRole(
  role: string | null | undefined
): role is BoardRole {
  return !!role && (ALLOWED_BOARD_ROLES as readonly string[]).includes(role);
}

export function normalizeRole(
  role: string | null | undefined
): BoardRole | null {
  if (!role) return null;
  return isAllowedBoardRole(role) ? role : null;
}
