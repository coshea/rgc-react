import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "@/api/users";
import type { User } from "@/api/users";

/**
 * Hook to fetch a specific user's profile by their ID
 * More efficient than useUsersMap when you only need one user
 */
export function useUserById(userId: string | undefined) {
  const query = useQuery<User | null>({
    queryKey: ["user", userId],
    queryFn: async () => {
      if (!userId) return null;
      const profile = await getUserProfile(userId);
      if (!profile) return null;

      // Convert UserProfilePayload to User by adding the id
      return {
        ...profile,
        id: userId,
      } as User;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes - user profiles don't change frequently
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
