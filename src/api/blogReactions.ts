// Member emoji reactions on blog posts, stored one doc per member at
// blogPosts/{postId}/reactions/{uid}. Only signed-in members can read or write.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import * as Sentry from "@sentry/react";

import { auth, db } from "@/config/firebase";
import {
  BLOG_REACTION_KEYS,
  type BlogReaction,
  type ReactionKey,
  isReactionKey,
} from "@/types/blog";

const BLOG_COLLECTION = "blogPosts";
const REACTIONS_SUBCOLLECTION = "reactions";
// Firestore caps a batch at 500 writes.
const DELETE_BATCH_SIZE = 450;

function reactionsCol(postId: string) {
  return collection(db, BLOG_COLLECTION, postId, REACTIONS_SUBCOLLECTION);
}

/** Puts keys in BLOG_REACTIONS order and drops duplicates and unknown keys. */
export function normalizeReactionKeys(keys: readonly unknown[]): ReactionKey[] {
  return BLOG_REACTION_KEYS.filter((key) => keys.includes(key));
}

export async function getBlogReactions(
  postId: string,
): Promise<BlogReaction[]> {
  return Sentry.startSpan(
    { name: "getBlogReactions", op: "db.query" },
    async () => {
      const snap = await getDocs(reactionsCol(postId));
      return snap.docs
        .map((d) => {
          const raw: unknown = d.data().emojis;
          const emojis = Array.isArray(raw)
            ? normalizeReactionKeys(raw.filter(isReactionKey))
            : [];
          return { uid: d.id, emojis };
        })
        .filter((r) => r.emojis.length > 0);
    },
  );
}

/**
 * Replaces the signed-in member's reactions on a post. An empty list removes
 * their reaction doc.
 */
export async function setMyBlogReactions(
  postId: string,
  uid: string,
  emojis: readonly ReactionKey[],
): Promise<void> {
  if (!uid || auth.currentUser?.uid !== uid) {
    throw new Error("You can only change your own reactions");
  }
  const ref = doc(db, BLOG_COLLECTION, postId, REACTIONS_SUBCOLLECTION, uid);
  const keys = normalizeReactionKeys(emojis);
  await Sentry.startSpan({ name: "setMyBlogReactions", op: "db.write" }, () =>
    keys.length === 0
      ? deleteDoc(ref)
      : setDoc(ref, { emojis: keys, updatedAt: serverTimestamp() }),
  );
}

/** Admin: removes every reaction on a post, before the post is deleted. */
export async function deleteAllBlogReactions(postId: string): Promise<void> {
  await Sentry.startSpan(
    { name: "deleteAllBlogReactions", op: "db.write" },
    async () => {
      const snap = await getDocs(reactionsCol(postId));
      for (let i = 0; i < snap.docs.length; i += DELETE_BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const d of snap.docs.slice(i, i + DELETE_BATCH_SIZE)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    },
  );
}
