import { useMemo } from "react";
import {
  useMembersSubscription,
  useDocAdminFlag,
} from "@/components/membership/hooks";
import { useAuth } from "@/providers/AuthProvider";

/**
 * useMembers
 * Unified hook for member data.
 * - Subscribes to all users when authenticated.
 * - Uses users.lastPaidYear to determine active status.
 * - If user is NOT an admin: returns only active members (paid within the last 2 years).
 * - If admin: returns full list plus activeSet to allow UI toggling.
 * Returned shape keeps parity with prior inline logic while standardizing filtering.
 */
export function useMembers(year = new Date().getFullYear()) {
  const { user, userLoggedIn, loading: authLoading } = useAuth();
  const { isAdmin, loadingAdmin } = useDocAdminFlag(user);
  const { members, loadingMembers, error } = useMembersSubscription(
    !!user && userLoggedIn,
  );

  const cutoffYear = year - 1;

  const activeSet = useMemo(() => {
    const toYear = (value: unknown) => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    return new Set(
      members
        .filter((m) => {
          const lastPaidYear = toYear(m.lastPaidYear);
          return typeof lastPaidYear === "number" && lastPaidYear >= cutoffYear;
        })
        .map((m) => m.id),
    );
  }, [members, cutoffYear]);

  const filteredMembers = useMemo(() => {
    if (isAdmin) return members; // admins get full list; UI can decide to filter
    return members.filter((m) => activeSet.has(m.id));
  }, [members, isAdmin, activeSet]);

  return {
    isAdmin,
    loading: authLoading || loadingAdmin || loadingMembers,
    members: filteredMembers,
    allMembers: members, // for admin toggles if needed
    activeSet,
    error,
    year,
  };
}

export type UseMembersReturn = ReturnType<typeof useMembers>;
