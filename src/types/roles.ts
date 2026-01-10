// Central definition of allowed board roles and ordering/metadata
export const ALLOWED_BOARD_ROLES = [
  "President",
  "Treasurer",
  "Handicap Chairman",
  "Tournament Chairman",
  "Webmaster",
  "Board Member",
] as const;

export type BoardRole = (typeof ALLOWED_BOARD_ROLES)[number];

// Central role metadata (icon name, chip color, explicit label override, priority)
// Keeping colors as 'any' to avoid tight coupling to UI lib typed enums here.
export const BOARD_ROLE_META: Record<
  BoardRole,
  { icon: string; color: any; label: string; priority: number }
> = {
  President: {
    icon: "lucide:crown",
    color: "warning",
    label: "President",
    priority: 1,
  },
  Treasurer: {
    icon: "lucide:wallet",
    color: "secondary",
    label: "Treasurer",
    priority: 2,
  },
  "Handicap Chairman": {
    icon: "lucide:target",
    color: "success",
    label: "Handicap Chairman",
    priority: 3,
  },
  "Tournament Chairman": {
    icon: "lucide:calendar-range",
    color: "primary",
    label: "Tournament Chairman",
    priority: 4,
  },
  Webmaster: {
    icon: "lucide:globe",
    color: "danger",
    label: "Webmaster",
    priority: 5,
  },
  "Board Member": {
    icon: "lucide:users",
    color: "default",
    label: "Board Member",
    priority: 6,
  },
};

/** Attempt to coerce an arbitrary raw role string to a normalized BoardRole */
export function coerceBoardRole(
  raw: string | null | undefined
): BoardRole | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Direct match first
  if (isAllowedBoardRole(trimmed)) return trimmed;
  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  const found = ALLOWED_BOARD_ROLES.find((r) => r.toLowerCase() === lower);
  return found || null;
}

export function getBoardRolePriority(role: string | null | undefined): number {
  const norm = coerceBoardRole(role);
  if (!norm) return 999; // large number to push unknowns to end
  return BOARD_ROLE_META[norm].priority;
}

export function formatBoardRoleLabel(role: string | null | undefined): string {
  const norm = coerceBoardRole(role);
  if (norm) return BOARD_ROLE_META[norm].label;
  // Fallback: prettify unknown role (title-case)
  if (!role) return "Board Member";
  return role
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

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
