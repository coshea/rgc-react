import { db } from "@/config/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type FirestoreError,
} from "firebase/firestore";
import type { SeasonAward, UpsertSeasonAwardInput } from "@/types/seasonAwards";

function toDate(value: unknown): Date {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  if (value instanceof Date) return value;

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mapSeasonAwardDoc(d: any): SeasonAward {
  const data = (d.data ? d.data() : d) as Record<string, unknown>;
  return {
    id: d.id,
    userId: String(data.userId || ""),
    userDisplayName: String(data.userDisplayName || data.userId || "Unknown"),
    awardType: String(data.awardType || "hole_in_one") as SeasonAward["awardType"],
    amount: Number(data.amount || 0),
    date: toDate(data.date),
    seasonYear: Number(data.seasonYear || new Date().getFullYear()),
    tournamentId:
      typeof data.tournamentId === "string" ? data.tournamentId : undefined,
    tournamentTitle:
      typeof data.tournamentTitle === "string"
        ? data.tournamentTitle
        : undefined,
    createdAt: data.createdAt ? toDate(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export function onSeasonAwardsByTournament(
  tournamentId: string,
  next: (items: SeasonAward[]) => void,
  error?: (error: FirestoreError) => void,
) {
  const ref = collection(db, "seasonAwards");
  const q = query(ref, where("tournamentId", "==", tournamentId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(mapSeasonAwardDoc);
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      next(items);
    },
    error,
  );
}

export function onSeasonAwardsByYear(
  seasonYear: number,
  next: (items: SeasonAward[]) => void,
  error?: (error: FirestoreError) => void,
) {
  const ref = collection(db, "seasonAwards");
  const q = query(ref, where("seasonYear", "==", seasonYear));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(mapSeasonAwardDoc);
      items.sort((a, b) => b.date.getTime() - a.date.getTime());
      next(items);
    },
    error,
  );
}

export async function fetchSeasonAwardsByYear(
  seasonYear: number,
): Promise<SeasonAward[]> {
  const ref = collection(db, "seasonAwards");
  const q = query(ref, where("seasonYear", "==", seasonYear));
  const snap = await getDocs(q);
  const items = snap.docs.map(mapSeasonAwardDoc);
  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return items;
}

export async function fetchSeasonAwardsByUser(
  userId: string,
): Promise<SeasonAward[]> {
  const ref = collection(db, "seasonAwards");
  const q = query(ref, where("userId", "==", userId));
  const snap = await getDocs(q);
  const items = snap.docs.map(mapSeasonAwardDoc);
  items.sort((a, b) => b.date.getTime() - a.date.getTime());
  return items;
}

export async function upsertSeasonAward(
  input: UpsertSeasonAwardInput,
): Promise<string> {
  const payload = {
    userId: input.userId,
    userDisplayName: input.userDisplayName,
    awardType: input.awardType,
    amount: input.amount,
    date: input.date,
    seasonYear: input.seasonYear,
    tournamentId: input.tournamentId || null,
    tournamentTitle: input.tournamentTitle || null,
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    const ref = doc(db, "seasonAwards", input.id);
    await setDoc(ref, payload, { merge: true });
    return input.id;
  }

  const created = await addDoc(collection(db, "seasonAwards"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteSeasonAward(id: string): Promise<void> {
  await deleteDoc(doc(db, "seasonAwards", id));
}
