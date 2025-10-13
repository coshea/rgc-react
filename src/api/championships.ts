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
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import type {
  HistoricalChampionship,
  UnifiedChampionship,
} from "@/types/championship";

// Pagination interface for championship queries
export interface ChampionshipPage {
  championships: UnifiedChampionship[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
}

// Fetch championships with pagination support
export async function fetchChampionshipsWithPagination(
  options: {
    year?: number;
    pageSize?: number;
    cursor?: QueryDocumentSnapshot<DocumentData>;
  } = {}
): Promise<ChampionshipPage> {
  const { year, pageSize = 20, cursor } = options;

  const champCol = collection(db, "championships");
  const conditions = [];

  if (year) {
    conditions.push(where("year", "==", year));
  }

  let q = query(
    champCol,
    ...conditions,
    orderBy("year", "desc"),
    limit(pageSize + 1) // Fetch one extra to check if there are more
  );

  if (cursor) {
    q = query(q, startAfter(cursor));
  }

  const snap = await getDocs(q);

  const docs = snap.docs;

  // Check if we have more data by looking at the extra document
  const hasMore = docs.length > pageSize;
  const championshipsToReturn = hasMore ? docs.slice(0, pageSize) : docs;

  const championships = championshipsToReturn.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      year: data.year,
      championshipType: data.championshipType,
      winnerNames: data.winnerNames,
      winnerIds: data.winnerIds,
      runnerUpNames: data.runnerUpNames,
      runnerUpIds: data.runnerUpIds,
      isHistorical: data.isHistorical,
    } as UnifiedChampionship;
  });

  // Sort by championship type in JavaScript since we can't include it in the Firestore query
  championships.sort((a, b) =>
    a.championshipType.localeCompare(b.championshipType)
  );

  return {
    championships,
    nextCursor: hasMore
      ? championshipsToReturn[championshipsToReturn.length - 1]
      : undefined,
    hasMore,
  };
}

// Fetch all championships (both historical and modern) from the championships collection
export async function fetchAllChampionships(
  year?: number
): Promise<UnifiedChampionship[]> {
  const champCol = collection(db, "championships");
  const conditions = [];

  if (year) {
    conditions.push(where("year", "==", year));
  }

  const q =
    conditions.length > 0
      ? query(champCol, ...conditions, orderBy("year", "desc"))
      : query(champCol, orderBy("year", "desc"));

  const snap = await getDocs(q);

  const championships = snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      year: data.year,
      championshipType: data.championshipType,
      winnerNames: data.winnerNames,
      winnerIds: data.winnerIds,
      runnerUpNames: data.runnerUpNames,
      runnerUpIds: data.runnerUpIds,
      isHistorical: data.isHistorical,
    } as UnifiedChampionship;
  });

  return championships;
}

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
        createdAt: docSnap.data().createdAt?.toDate() ?? null,
        updatedAt: docSnap.data().updatedAt?.toDate() ?? null,
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
  // First, check for modern championships in the championships collection (isHistorical: false)
  const champCol = collection(db, "championships");
  const champConditions = [where("isHistorical", "==", false)];

  if (year) {
    champConditions.push(where("year", "==", year));
  }

  const champQuery = query(champCol, ...champConditions);
  const champSnap = await getDocs(champQuery);

  // Convert championship docs to unified format
  const modernFromChampionships: UnifiedChampionship[] = champSnap.docs.map(
    (doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        year: data.year,
        championshipType: data.championshipType,
        winnerNames: data.winnerNames,
        winnerIds: data.winnerIds,
        runnerUpNames: data.runnerUpNames,
        runnerUpIds: data.runnerUpIds,
        isHistorical: data.isHistorical,
      };
    }
  );

  return modernFromChampionships;
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

// Optimized function to fetch championships where user is a winner
// Note: The individual fetchUserChampionshipsAsWinner and fetchUserChampionshipsAsRunnerUp
// functions had issues with array-contains queries, so we use fetchUserChampionships instead
// which fetches all championships and filters manually

// Optimized function to fetch all championships for a specific user
export async function fetchUserChampionships(
  userId: string
): Promise<UnifiedChampionship[]> {
  // Note: Using manual filtering instead of array-contains query due to Firestore query issues
  const col = collection(db, "championships");
  const snap = await getDocs(col);

  const matchingChampionships: UnifiedChampionship[] = [];

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const winnerIds = data.winnerIds || [];
    const runnerUpIds = data.runnerUpIds || [];

    // Check if user is in either winners or runners-up
    if (winnerIds.includes(userId) || runnerUpIds.includes(userId)) {
      matchingChampionships.push({
        id: docSnap.id,
        year: data.year,
        championshipType: data.championshipType,
        winnerNames: data.winnerNames,
        winnerIds: data.winnerIds,
        runnerUpNames: data.runnerUpNames,
        runnerUpIds: data.runnerUpIds,
        isHistorical: data.isHistorical,
      } as UnifiedChampionship);
    }
  });

  // Sort by year (desc), then by championship type
  matchingChampionships.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return a.championshipType.localeCompare(b.championshipType);
  });

  return matchingChampionships;
}
