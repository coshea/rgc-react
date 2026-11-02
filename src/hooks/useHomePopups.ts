import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  deleteHomePopup,
  fetchAllHomePopups,
  fetchHomePopupDismissals,
  fetchHomePopupResponseCounts,
  fetchHomePopupResponses,
  fetchPublishedHomePopups,
  recordHomePopupDismissal,
  saveHomePopup,
  type HomePopupResponseCounts,
  type SaveHomePopupOptions,
} from "@/api/homePopups";
import type { HomePopupAction, HomePopupInput } from "@/types/homePopup";
import { rememberLocalDismissal } from "@/utils/homePopup";

export const homePopupKeys = {
  all: ["homePopups"] as const,
  published: (signedIn: boolean) => ["homePopupsPublished", signedIn] as const,
  dismissals: (uid: string) => ["homePopupDismissals", uid] as const,
  responses: (popupId: string) => ["homePopupResponses", popupId] as const,
  responseCounts: (popupId: string) =>
    ["homePopupResponseCounts", popupId] as const,
};

/** Admin: every popup, drafts included. */
export function useAllHomePopups(enabled: boolean) {
  return useQuery({
    queryKey: homePopupKeys.all,
    queryFn: fetchAllHomePopups,
    enabled,
  });
}

export function usePublishedHomePopups(signedIn: boolean, enabled: boolean) {
  return useQuery({
    queryKey: homePopupKeys.published(signedIn),
    queryFn: () => fetchPublishedHomePopups(signedIn),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHomePopupDismissals(uid: string | undefined) {
  return useQuery({
    queryKey: homePopupKeys.dismissals(uid ?? ""),
    queryFn: () => fetchHomePopupDismissals(uid!),
    enabled: !!uid,
    staleTime: Infinity,
  });
}

function useInvalidateHomePopups() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: homePopupKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["homePopupsPublished"] }),
    ]);
}

export function useSaveHomePopup() {
  const invalidate = useInvalidateHomePopups();
  return useMutation({
    mutationFn: ({
      input,
      options,
    }: {
      input: HomePopupInput;
      options?: SaveHomePopupOptions;
    }) => saveHomePopup(input, options),
    onSettled: invalidate,
  });
}

export function useDeleteHomePopup() {
  const invalidate = useInvalidateHomePopups();
  return useMutation({
    mutationFn: (id: string) => deleteHomePopup(id),
    onSettled: invalidate,
  });
}

/** Admin: clicked/closed totals for each popup, keyed by popup id. */
export function useHomePopupResponseCounts(popupIds: readonly string[]) {
  return useQueries({
    queries: popupIds.map((id) => ({
      queryKey: homePopupKeys.responseCounts(id),
      queryFn: () => fetchHomePopupResponseCounts(id),
      staleTime: 60_000,
    })),
    combine: (results): Record<string, HomePopupResponseCounts | undefined> =>
      Object.fromEntries(popupIds.map((id, i) => [id, results[i]?.data])),
  });
}

/** Admin: who clicked or closed a popup. */
export function useHomePopupResponses(popupId: string | undefined) {
  return useQuery({
    queryKey: homePopupKeys.responses(popupId ?? ""),
    queryFn: () => fetchHomePopupResponses(popupId!),
    enabled: !!popupId,
    staleTime: 60_000,
  });
}

/**
 * Remembers a dismissal on this device, and on the member's account when
 * signed in so it doesn't come back on their other devices. Pass `response`
 * to also record for admins whether the member clicked or closed it.
 */
export function useDismissHomePopup(uid: string | undefined) {
  const queryClient = useQueryClient();
  const key = homePopupKeys.dismissals(uid ?? "");
  return useMutation({
    mutationFn: async ({
      id,
      version,
      response,
    }: {
      id: string;
      version: number;
      response?: { action: HomePopupAction; link?: string };
    }) => {
      rememberLocalDismissal(id, version);
      if (uid) await recordHomePopupDismissal(uid, id, version, response);
    },
    // No rollback on error: the local copy still hides it on this device, and
    // re-opening the popup because a write failed would be worse.
    onMutate: async ({ id, version }) => {
      if (!uid) return;
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Record<string, number>>(key, (previous) => ({
        ...previous,
        [id]: version,
      }));
    },
    onSettled: () => {
      if (uid) void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
