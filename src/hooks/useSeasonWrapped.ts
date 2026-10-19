import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchWrappedAdminRows,
  fetchWrappedSeason,
  fetchWrappedShareImage,
  fetchWrappedStory,
  generateWrapped,
  publishWrapped,
} from "@/api/seasonWrapped";

export const wrappedKeys = {
  season: (year: number) => ["wrappedSeason", year] as const,
  story: (year: number, uid: string) => ["wrappedStory", year, uid] as const,
  admin: (year: number) => ["wrappedAdmin", year] as const,
  shareImage: (year: number, uid: string, version: number) =>
    ["wrappedShareImage", year, uid, version] as const,
};

export function useWrappedSeason(year: number, enabled = true) {
  return useQuery({
    queryKey: wrappedKeys.season(year),
    queryFn: () => fetchWrappedSeason(year),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWrappedStory(year: number, uid: string | undefined) {
  return useQuery({
    queryKey: wrappedKeys.story(year, uid ?? ""),
    queryFn: () => fetchWrappedStory(year, uid!),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWrappedAdminRows(year: number, enabled = true) {
  return useQuery({
    queryKey: wrappedKeys.admin(year),
    queryFn: () => fetchWrappedAdminRows(year),
    enabled,
  });
}

/**
 * Loads the share image ahead of time, so tapping Share can open the share
 * sheet straight away (iOS drops the share if the tap has to wait on a fetch).
 * Keyed by story version, so a regenerated story gets a fresh image.
 */
export function useWrappedShareImage(
  year: number,
  uid: string | undefined,
  version: number | undefined,
  options: { asAdmin: boolean; enabled: boolean },
) {
  return useQuery({
    queryKey: wrappedKeys.shareImage(year, uid ?? "", version ?? 0),
    queryFn: () => fetchWrappedShareImage({ year, ...(options.asAdmin ? { uid } : {}) }),
    enabled: options.enabled && !!uid && version !== undefined,
    staleTime: Infinity,
    retry: 1,
  });
}

function useInvalidateWrapped(year: number) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: wrappedKeys.season(year) }),
      queryClient.invalidateQueries({ queryKey: wrappedKeys.admin(year) }),
      queryClient.invalidateQueries({ queryKey: ["wrappedStory", year] }),
    ]);
}

export function useGenerateWrapped(year: number) {
  const invalidate = useInvalidateWrapped(year);
  return useMutation({
    mutationFn: (uids?: string[]) => generateWrapped({ year, ...(uids ? { uids } : {}) }),
    onSettled: invalidate,
  });
}

export function usePublishWrapped(year: number) {
  const invalidate = useInvalidateWrapped(year);
  return useMutation({
    mutationFn: (published: boolean) => publishWrapped({ year, published }),
    onSettled: invalidate,
  });
}
