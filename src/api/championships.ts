// Centralized championship-related Firestore access.
// Handles both historical championship records and modern tournament-based championships.

import { db } from "@/config/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  FirestoreError,
} from "firebase/firestore";
import type {
  HistoricalChampionship,
  UnifiedChampionship,
} from "@/types/championship";

// Fetch all historical championships with optional filtering
export async function fetchHistoricalChampionships(
  year?: number
): Promise<HistoricalChampionship[]> {
  const col = collection(db, "championships");
  const conditions = [where("isHistorical", "==", true)];

  if (year) {
    conditions.push(where("year", "==", year));
  }

  const q = query(col, ...conditions, orderBy("year", "desc"));
  const snap = await getDocs(q);

  const championships = snap.docs.map(
    (docSnap) =>
      ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
      }) as HistoricalChampionship
  );

  // Sort by championshipType in JavaScript to ensure stable ordering
  championships.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.championshipType.localeCompare(b.championshipType);
  });

  return championships;
}

// Fetch modern championships from tournament winners
export async function fetchModernChampionships(
  year?: number
): Promise<UnifiedChampionship[]> {
  // Direct Firestore access to avoid circular dependencies with hooks
  const tournamentsCol = collection(db, "tournaments");
  const conditions = [];

  if (year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    conditions.push(where("date", ">=", start), where("date", "<", end));
  }

  const q = query(tournamentsCol, ...conditions, orderBy("date", "desc"));
  const snap = await getDocs(q);

  const championships: UnifiedChampionship[] = [];

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const date = data.date?.toDate?.() || new Date(data.date);
    const winners = data.winners || [];

    // Find championship winners (those marked with isChampion)
    const championWinners = winners.filter((w: any) => w.isChampion);

    championWinners.forEach((winner: any) => {
      championships.push({
        id: `tournament-${docSnap.id}-${winner.place}`,
        year: date.getFullYear(),
        championshipType: winner.championshipType || "other",
        winnerNames: winner.displayNames || ["Unknown"],
        winnerIds: winner.userIds,
        isHistorical: false,
      });
    });
  });

  return championships;
}

// Create a new historical championship record
export async function createHistoricalChampionship(
  championship: Omit<HistoricalChampionship, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const col = collection(db, "championships");
  const docRef = await addDoc(col, {
    ...championship,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// Update an existing historical championship
export async function updateHistoricalChampionship(
  id: string,
  updates: Partial<Omit<HistoricalChampionship, "id" | "createdAt">>
): Promise<void> {
  const docRef = doc(db, "championships", id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Delete a historical championship
export async function deleteHistoricalChampionship(id: string): Promise<void> {
  const docRef = doc(db, "championships", id);
  await deleteDoc(docRef);
}

// Get a single historical championship by ID
export async function getHistoricalChampionship(
  id: string
): Promise<HistoricalChampionship | null> {
  const docRef = doc(db, "championships", id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as HistoricalChampionship;
}

// Real-time listener for historical championships
export function onHistoricalChampionships(
  next: (championships: HistoricalChampionship[]) => void,
  error?: (error: FirestoreError) => void,
  year?: number
) {
  const col = collection(db, "championships");
  const conditions = [where("isHistorical", "==", true)];

  if (year) {
    conditions.push(where("year", "==", year));
  }

  const q = query(
    col,
    ...conditions,
    orderBy("year", "desc"),
    orderBy("championshipType", "asc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const championships = snap.docs.map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate() || new Date(),
            updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
          }) as HistoricalChampionship
      );
      next(championships);
    },
    error
  );
}
