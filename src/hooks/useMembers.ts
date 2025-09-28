import { useMemo } from "react";
import {
  useMembersSubscription,
  useDocAdminFlag,
} from "@/components/membership/hooks";
import { useActiveMembers } from "@/hooks/useActiveMembers";
import { useAuth } from "@/providers/AuthProvider";

/**
 * useMembers
 * Unified hook for member data.
 * - Subscribes to all users when authenticated.
 * - Fetches active member payment records for current year.
 * - If user is NOT an admin: returns only active members (confirmed payment this year).
 * - If admin: returns full list plus activeSet to allow UI toggling.
 * Returned shape keeps parity with prior inline logic while standardizing filtering.
 */
export function useMembers(year = new Date().getFullYear()) {
  const { user, userLoggedIn, loading: authLoading } = useAuth();
  const { isAdmin, loadingAdmin } = useDocAdminFlag(user);
  const { members, loadingMembers, error } = useMembersSubscription(
    !!user && userLoggedIn
  );
  const { data: activeRecords, isLoading: loadingActive } =
    useActiveMembers(year);

  const activeSet = useMemo(
    () => new Set(activeRecords?.map((r) => r.userId) || []),
    [activeRecords]
  );

  const filteredMembers = useMemo(() => {
    if (isAdmin) return members; // admins get full list; UI can decide to filter
    return members.filter((m) => activeSet.has(m.id));
  }, [members, isAdmin, activeSet]);

  return {
    isAdmin,
    loading: authLoading || loadingAdmin || loadingMembers || loadingActive,
    members: filteredMembers,
    allMembers: members, // for admin toggles if needed
    activeSet,
    error,
    year,
  };
}

export type UseMembersReturn = ReturnType<typeof useMembers>;
