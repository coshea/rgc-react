import { useQuery } from "@tanstack/react-query";
import { getUsers, type User } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";
import { useMemo } from "react";

/**
 * useUsers
 * React Query powered fetch of all user profiles (alphabetically ordered).
 * Caches for 5 minutes (stale) and keeps previous data to avoid UI flicker.
 * For public use (championships): always enabled to show names only
 * For full profiles: only enabled when authenticated to avoid permission errors.
 */
export function useUsers(options: { publicNamesOnly?: boolean } = {}) {
  const { userLoggedIn } = useAuth();
  const { publicNamesOnly = false } = options;

  const query = useQuery<User[]>({
    queryKey: ["users", publicNamesOnly ? "public" : "full"],
    queryFn: () => getUsers(),
    enabled: publicNamesOnly || userLoggedIn, // Always enabled for public names, auth required for full profiles
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // garbage collect after 10 minutes idle
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // keep previous to prevent flash
  });

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * useUsersMap
 * Lightweight derived hook returning an id->User map for O(1) lookups.
 * Memoized off the users array reference.
 * For public use (championships): pass publicNamesOnly: true to get basic user info without auth
 */
export function useUsersMap(options: { publicNamesOnly?: boolean } = {}) {
  const { users, isLoading, isFetching } = useUsers(options);
  const map = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);
  return { usersMap: map, isLoading, isFetching, count: users.length };
}
