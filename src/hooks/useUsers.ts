import { useQuery } from "@tanstack/react-query";
import { getUsers, type User } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";
import { useMemo } from "react";

/**
 * useUsers
 * React Query powered fetch of all user profiles (alphabetically ordered).
 * Caches for 5 minutes (stale) and keeps previous data to avoid UI flicker.
 * Only enabled when a user is authenticated to avoid permission errors.
 */
export function useUsers() {
  const { userLoggedIn } = useAuth();

  const query = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => getUsers(),
    enabled: userLoggedIn,
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
 */
export function useUsersMap() {
  const { users, isLoading, isFetching } = useUsers();
  const map = useMemo(() => {
    const m = new Map<string, User>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);
  return { usersMap: map, isLoading, isFetching, count: users.length };
}
