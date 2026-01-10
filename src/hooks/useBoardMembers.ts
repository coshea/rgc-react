import { useMemo } from "react";
import { useUsers } from "@/hooks/useUsers";
import {
  BOARD_ROLE_META,
  coerceBoardRole,
  getBoardRolePriority,
  formatBoardRoleLabel,
  type BoardRole,
} from "@/types/roles";
import type { User } from "@/api/users";

export interface EnrichedBoardMember extends User {
  normalizedRole: BoardRole | null;
  roleLabel: string;
  rolePriority: number;
  roleMeta: (typeof BOARD_ROLE_META)[BoardRole] | null;
  isPresident: boolean;
}

/**
 * useBoardMembers
 * Derived hook providing a filtered & sorted list of board members enriched with
 * normalized role info, label, metadata, and convenience booleans.
 *
 * Sorting: primary by priority (BOARD_ROLE_META priority ascending),
 * then by displayName/email (case-insensitive) for stable ordering.
 */
export function useBoardMembers() {
  const { users, isLoading, isFetching, isError, error, refetch } = useUsers();

  const boardMembers: EnrichedBoardMember[] = useMemo(() => {
    if (!users?.length) return [];

    // Single source of truth: only users explicitly flagged as board members.
    // We DO NOT treat `role`/`boardRole` presence as implying board membership;
    // legacy docs may have stale role fields and should not appear here.
    const filtered = users.filter((u) => u.boardMember === true);

    const enriched: EnrichedBoardMember[] = filtered.map((u) => {
      const rawRole = u.role ?? null;
      const normalizedRole = coerceBoardRole(rawRole);
      const rolePriority = getBoardRolePriority(rawRole);
      const roleLabel = formatBoardRoleLabel(rawRole);
      const roleMeta = normalizedRole ? BOARD_ROLE_META[normalizedRole] : null;
      const isPresident =
        normalizedRole === "President" ||
        roleLabel.toLowerCase() === "president";

      return {
        ...u,
        normalizedRole,
        roleLabel,
        rolePriority,
        roleMeta,
        isPresident,
      };
    });

    enriched.sort((a, b) => {
      if (a.rolePriority !== b.rolePriority)
        return a.rolePriority - b.rolePriority;
      const na = (a.displayName || a.email || "").toLowerCase();
      const nb = (b.displayName || b.email || "").toLowerCase();
      return na.localeCompare(nb);
    });

    return enriched;
  }, [users]);

  const president = useMemo(
    () => boardMembers.find((m) => m.isPresident) || null,
    [boardMembers]
  );

  return {
    boardMembers,
    president,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
}
