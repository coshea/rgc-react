import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  fetchAllChampionships,
  fetchHistoricalChampionships,
  fetchChampionshipsWithPagination,
  fetchUserChampionships,
  type ChampionshipPage,
} from "@/api/championships";
import type {
  UnifiedChampionship,
  HistoricalChampionship,
} from "@/types/championship";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

interface UseAllChampionshipsOptions {
  year?: number;
  enabled?: boolean; // Keep interface for backwards compatibility but ignore the value
}

export function useAllChampionships({
  year,
  enabled: _enabled = true, // Underscore prefix to indicate intentionally unused
}: UseAllChampionshipsOptions = {}) {
  const query = useQuery<UnifiedChampionship[]>({
    queryKey: ["allChampionships", year],
    enabled: true, // Always enabled since championships are publicly readable
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

// Infinite scrolling hook for championships
interface UseInfiniteChampionshipsOptions {
  year?: number;
  pageSize?: number;
  enabled?: boolean; // Keep interface for backwards compatibility but ignore the value
}

export function useInfiniteChampionships({
  year,
  pageSize = 20,
  enabled: _enabled = true, // Underscore prefix to indicate intentionally unused
}: UseInfiniteChampionshipsOptions = {}) {
  const query = useInfiniteQuery({
    queryKey: ["infiniteChampionships", year ?? "all", pageSize],
    enabled: true, // Always enabled since championships are publicly readable
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    queryFn: async ({
      pageParam,
    }: {
      pageParam: QueryDocumentSnapshot<DocumentData> | undefined;
    }) => {
      return await fetchChampionshipsWithPagination({
        year,
        pageSize,
        cursor: pageParam,
      });
    },
    getNextPageParam: (lastPage: ChampionshipPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined;
    },
    initialPageParam: undefined as
      | QueryDocumentSnapshot<DocumentData>
      | undefined,
  });

  // Flatten all pages into a single array
  const allChampionships: UnifiedChampionship[] =
    query.data?.pages?.flatMap(
      (page: ChampionshipPage) => page.championships
    ) || [];

  return {
    championships: allChampionships,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

// Hook specifically for historical championships (admin use)
export function useHistoricalChampionships({
  year,
  enabled: _enabled = true, // Underscore prefix to indicate intentionally unused
}: UseAllChampionshipsOptions = {}) {
  return useQuery<HistoricalChampionship[]>({
    queryKey: ["historicalChampionships", year],
    enabled: true, // Always enabled since championships are publicly readable
    queryFn: () => fetchHistoricalChampionships(year),
    staleTime: 1000 * 60 * 5,
  });
}

// Hook for user's personal championship achievements
interface UseUserChampionshipsOptions {
  userId: string;
  enabled?: boolean;
}

interface UserChampionshipsResult {
  championships: UnifiedChampionship[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  totalChampionships: number;
  totalRunnerUps: number;
}

export function useUserChampionships({
  userId,
  enabled = true,
}: UseUserChampionshipsOptions): UserChampionshipsResult {
  const query = useQuery<UnifiedChampionship[]>({
    queryKey: ["userChampionships", userId],
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes - championships don't change often
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    queryFn: () => fetchUserChampionships(userId),
  });

  const championships = query.data || [];

  return {
    championships,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    totalChampionships: championships.filter((c) =>
      c.winnerIds?.includes(userId)
    ).length,
    totalRunnerUps: championships.filter((c) => c.runnerUpIds?.includes(userId))
      .length,
  };
}
