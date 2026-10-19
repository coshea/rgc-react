import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";

import {
  getBlogReactions,
  normalizeReactionKeys,
  setMyBlogReactions,
} from "@/api/blogReactions";
import { useAuth } from "@/providers/AuthProvider";
import { addToast } from "@/providers/toast";
import { extractFirebaseAuthError } from "@/utils/firebaseErrors";
import {
  BLOG_REACTION_KEYS,
  type BlogReaction,
  type ReactionKey,
} from "@/types/blog";

export const blogReactionsKey = (postId: string) =>
  ["blogReactions", postId] as const;

export interface BlogReactionSummary {
  counts: Record<ReactionKey, number>;
  /** uids per emoji, in the order their docs were read. */
  reactors: Record<ReactionKey, string[]>;
  mine: ReactionKey[];
  total: number;
}

export function summarizeReactions(
  reactions: readonly BlogReaction[],
  myUid: string | undefined,
): BlogReactionSummary {
  const counts = Object.fromEntries(
    BLOG_REACTION_KEYS.map((k) => [k, 0]),
  ) as Record<ReactionKey, number>;
  const reactors = Object.fromEntries(
    BLOG_REACTION_KEYS.map((k) => [k, [] as string[]]),
  ) as Record<ReactionKey, string[]>;
  let mine: ReactionKey[] = [];
  let total = 0;
  for (const r of reactions) {
    for (const key of r.emojis) {
      counts[key] += 1;
      reactors[key].push(r.uid);
      total += 1;
    }
    if (r.uid === myUid) mine = r.emojis;
  }
  return { counts, reactors, mine, total };
}

/** Reactions on one post. Signed-in members only; disabled while logged out. */
export function useBlogReactions(postId: string | undefined) {
  const { user, userLoggedIn } = useAuth();
  const query = useQuery({
    queryKey: blogReactionsKey(postId ?? ""),
    queryFn: () => getBlogReactions(postId ?? ""),
    enabled: !!postId && userLoggedIn,
    staleTime: 30_000,
  });
  const summary = useMemo(
    () => summarizeReactions(query.data ?? [], user?.uid),
    [query.data, user?.uid],
  );
  return { ...summary, isLoading: query.isLoading };
}

function withMyReaction(
  reactions: readonly BlogReaction[],
  uid: string,
  emojis: ReactionKey[],
): BlogReaction[] {
  const others = reactions.filter((r) => r.uid !== uid);
  return emojis.length > 0 ? [...others, { uid, emojis }] : others;
}

/** Toggles one emoji for the signed-in member, updating the cache optimistically. */
export function useToggleBlogReaction(postId: string) {
  const { user } = useAuth();
  const uid = user?.uid;
  const qc = useQueryClient();
  const key = blogReactionsKey(postId);

  const mutation = useMutation({
    mutationFn: (emojis: ReactionKey[]) => {
      if (!uid) throw new Error("Not authenticated");
      return setMyBlogReactions(postId, uid, emojis);
    },
    onMutate: async (emojis) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BlogReaction[]>(key);
      if (uid) {
        qc.setQueryData<BlogReaction[]>(key, (old) =>
          withMyReaction(old ?? [], uid, emojis),
        );
      }
      return { previous };
    },
    onError: (error, _emojis, context) => {
      qc.setQueryData(key, context?.previous);
      Sentry.captureException(error);
      addToast(
        extractFirebaseAuthError(error)?.code === "permission-denied"
          ? {
              title: "Access Denied",
              description: "You do not have permission to perform this action.",
              color: "danger",
            }
          : {
              title: "Couldn't save your reaction",
              description: "Please try again.",
              color: "danger",
            },
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const toggle = (emoji: ReactionKey) => {
    if (!uid) return;
    // Read from the cache, not a render snapshot, so quick taps build on each
    // other's optimistic updates.
    const current =
      qc.getQueryData<BlogReaction[]>(key)?.find((r) => r.uid === uid)
        ?.emojis ?? [];
    const next = current.includes(emoji)
      ? current.filter((k) => k !== emoji)
      : normalizeReactionKeys([...current, emoji]);
    mutation.mutate(next);
  };

  return { toggle, isPending: mutation.isPending };
}
