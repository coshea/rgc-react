import { auth, db } from "@/config/firebase";
import { isAdminUser } from "@/utils/admin";
import type { FieldValue } from "firebase/firestore";

/** YYYY-MM-DD string (local date) used for query bucketing */
export type YMD = string;

export type PartnerPostType = "needPlayers" | "needGroup";

export interface FindAGamePost {
  id: string;
  type: PartnerPostType;
  date: YMD; // YYYY-MM-DD (local)
  time?: string; // HH:mm optional (only for needPlayers)
  openSpots?: number; // only for needPlayers
  ownerId: string;
  createdAt: Date;
}

// Firestore document shape for writes
type FindAGameDocWrite = {
  type: PartnerPostType;
  date: YMD;
  ownerId: string;
  createdAt: FieldValue;
  time?: string | null;
  openSpots?: number | null;
};

// Firestore update shape (exclude createdAt/ownerId)
type FindAGameDocUpdate = Partial<
  Omit<FindAGameDocWrite, "createdAt" | "ownerId">
>;

export interface CreatePostInput {
  type: PartnerPostType;
  date: YMD;
  time?: string;
  openSpots?: number;
}

export interface UpdatePostInput {
  type?: PartnerPostType;
  date?: YMD;
  time?: string;
  openSpots?: number;
}

export function toYMD(d: Date): YMD {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function createPartnerPost(input: CreatePostInput) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  if (!input.date || !/\d{4}-\d{2}-\d{2}/.test(input.date))
    throw new Error("Invalid date format (expected YYYY-MM-DD)");
  if (input.type === "needPlayers") {
    if (
      typeof input.openSpots !== "number" ||
      input.openSpots < 1 ||
      input.openSpots > 3
    )
      throw new Error("Open spots must be 1-3 for 'need players'");
  }

  const { addDoc, collection, serverTimestamp } = await import(
    "firebase/firestore"
  );
  const col = collection(db, "findAGame");
  const payload: FindAGameDocWrite = {
    type: input.type,
    date: input.date,
    ownerId: user.uid,
    createdAt: serverTimestamp(),
  };

  // Only include time if provided and not empty
  if (input.time && input.time.trim() !== "") {
    payload.time = input.time.trim();
  }

  // Handle type-specific fields
  if (input.type === "needPlayers") {
    // input.openSpots is validated above to be a number in [1,3]
    payload.openSpots = input.openSpots!;
  }
  const ref = await addDoc(col, payload);
  return ref.id;
}

export async function onPostsForDate(
  date: YMD,
  next: (posts: FindAGamePost[]) => void,
  error?: (e: unknown) => void
) {
  const { collection, onSnapshot, query, where, orderBy } = await import(
    "firebase/firestore"
  );
  const col = collection(db, "findAGame");
  const q = query(col, where("date", "==", date), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(
    q,
    (snap) => {
      const rows: FindAGamePost[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          type: data.type,
          date: data.date,
          time: data.time || undefined,
          openSpots:
            typeof data.openSpots === "number" ? data.openSpots : undefined,
          ownerId: data.ownerId,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } satisfies FindAGamePost;
      });
      next(rows);
    },
    (e) => error?.(e)
  );
  return unsub;
}

export async function onFuturePosts(
  next: (posts: FindAGamePost[]) => void,
  error?: (e: unknown) => void
) {
  const today = toYMD(new Date());
  const { collection, onSnapshot, query, where, orderBy } = await import(
    "firebase/firestore"
  );
  const col = collection(db, "findAGame");
  const q = query(
    col,
    where("date", ">=", today),
    orderBy("date", "asc"),
    orderBy("createdAt", "desc")
  );
  const unsub = onSnapshot(
    q,
    (snap) => {
      const rows: FindAGamePost[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          type: data.type,
          date: data.date,
          time: data.time || undefined,
          openSpots:
            typeof data.openSpots === "number" ? data.openSpots : undefined,
          ownerId: data.ownerId,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } satisfies FindAGamePost;
      });
      next(rows);
    },
    (e) => error?.(e)
  );
  return unsub;
}

export async function updatePartnerPost(id: string, updates: UpdatePostInput) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const { doc, getDoc, updateDoc } = await import("firebase/firestore");
  const ref = doc(db, "findAGame", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Post not found");
  const data = snap.data() as any;
  const ownerId = data.ownerId as string | undefined;
  const admin = await isAdminUser(user.uid);
  if (user.uid !== ownerId && !admin)
    throw new Error("Not authorized to update");

  const nextType: PartnerPostType = (updates.type ||
    data.type) as PartnerPostType;
  const nextDate: YMD = (updates.date || data.date) as YMD;
  if (!nextDate || !/\d{4}-\d{2}-\d{2}/.test(nextDate))
    throw new Error("Invalid date format (expected YYYY-MM-DD)");

  const updatePayload: FindAGameDocUpdate = {
    type: nextType,
    date: nextDate,
  };

  if (nextType === "needPlayers") {
    const t = updates.time ?? data.time;
    const s = updates.openSpots ?? data.openSpots;
    if (typeof s !== "number" || s < 1 || s > 3)
      throw new Error("Open spots must be 1-3 for 'need players'");

    // Only include time if provided and not empty
    if (t && String(t).trim() !== "") {
      updatePayload.time = String(t).trim();
    } else {
      // Explicitly remove time field if empty
      updatePayload.time = null;
    }
    updatePayload.openSpots = s;
  } else {
    // For needGroup, remove time and openSpots fields
    updatePayload.time = null;
    updatePayload.openSpots = null;
  }

  await updateDoc(ref, updatePayload);
}

export async function deletePartnerPost(id: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const { doc, getDoc, deleteDoc } = await import("firebase/firestore");
  const ref = doc(db, "findAGame", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return; // already gone
  const data = snap.data() as any;
  const ownerId = data.ownerId as string | undefined;
  const admin = await isAdminUser(user.uid);
  if (user.uid !== ownerId && !admin)
    throw new Error("Not authorized to delete");
  await deleteDoc(ref);
}
