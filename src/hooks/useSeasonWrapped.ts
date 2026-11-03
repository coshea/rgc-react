import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchWrappedEngagement,
  fetchWrappedSeason,
  fetchWrappedShareImage,
  fetchWrappedStory,
  generateWrapped,
  onWrappedGeneration,
  onWrappedMembers,
  publishWrapped,
  type WrappedAdminRow,
} from "@/api/seasonWrapped";
import { reportListenerError } from "@/utils/firebaseErrors";
import type { SeasonWrappedGeneration, SeasonWrappedMember } from "@@/seasonWrapped/types";

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

/**
 * Every member's story with delivery and open tracking. Admin only. Stories
 * are live, so a row updates the moment it's regenerated; delivery and views
 * are fetched (and refetched when `wrappedKeys.admin` is invalidated).
 */
export function useWrappedAdminRows(year: number) {
  const [live, setLive] = useState<{ year: number; members: SeasonWrappedMember[] } | null>(null);
  const engagement = useQuery({
    queryKey: wrappedKeys.admin(year),
    queryFn: () => fetchWrappedEngagement(year),
  });

  useEffect(
    () =>
      onWrappedMembers(
        year,
        (members) => setLive({ year, members }),
        (error) => reportListenerError("wrappedMembers", error),
      ),
    [year],
  );

  const members = live?.year === year ? live.members : null;
  const rows = useMemo<WrappedAdminRow[]>(
    () =>
      (members ?? []).map((story) => ({
        story,
        delivery: engagement.data?.deliveries.get(story.uid),
        view: engagement.data?.views.get(story.uid),
      })),
    [members, engagement.data],
  );
  return { rows, isLoading: members === null || engagement.isLoading };
}

/** Live generate progress for the season, keyed by uid. Admin only. */
export function useWrappedGeneration(year: number) {
  const [live, setLive] = useState<{ year: number; docs: SeasonWrappedGeneration[] } | null>(null);

  useEffect(
    () =>
      onWrappedGeneration(
        year,
        (docs) => setLive({ year, docs }),
        (error) => reportListenerError("wrappedGeneration", error),
      ),
    [year],
  );

  return useMemo(
    () => new Map((live?.year === year ? live.docs : []).map((d) => [d.uid, d])),
    [live, year],
  );
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
