import { useQuery } from "@tanstack/react-query";
import {
  fetchAllChampionships,
  fetchHistoricalChampionships,
} from "@/api/championships";
import type { UnifiedChampionship } from "@/types/championship";

interface UseAllChampionshipsOptions {
  year?: number;
  enabled?: boolean;
}

export function useAllChampionships({
  year,
  enabled = true,
}: UseAllChampionshipsOptions = {}) {
  const query = useQuery<UnifiedChampionship[]>({
    queryKey: ["allChampionships", year],
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - prevent unnecessary refetches
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Use the new simplified function that gets all championships
      const allChampionships = await fetchAllChampionships(year);

      // Sort by year (desc), then by championship type
      allChampionships.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return a.championshipType.localeCompare(b.championshipType);
      });

      return allChampionships;
    },
  });

  return {
    championships: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook specifically for historical championships (admin use)
export function useHistoricalChampionships({
  year,
  enabled = true,
}: UseAllChampionshipsOptions = {}) {
  return useQuery({
    queryKey: ["historicalChampionships", year],
    enabled,
    queryFn: () => fetchHistoricalChampionships(year),
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for user's personal championship achievements
interface UseUserChampionshipsOptions {
  userId: string;
  enabled?: boolean;
}

export function useUserChampionships({
  userId,
  enabled = true,
}: UseUserChampionshipsOptions) {
  const { championships, isLoading, isError } = useAllChampionships({
    enabled,
  });

  const userChampionships = championships.filter(
    (c) => c.winnerIds?.includes(userId) || c.runnerUpIds?.includes(userId)
  );

  return {
    championships: userChampionships,
    isLoading,
    isError,
    totalChampionships: userChampionships.filter((c) =>
      c.winnerIds?.includes(userId)
    ).length,
    totalRunnerUps: userChampionships.filter((c) =>
      c.runnerUpIds?.includes(userId)
    ).length,
  };
}
