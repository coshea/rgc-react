import { TournamentStatus } from "@/types/tournament";
import { getStatus } from "@/utils/tournamentStatus";
// Centralized tournament-related Firestore access.
// Components and hooks should import ONLY from this module (or hooks built atop it),
// not directly from '@/config/firebase' or 'firebase/firestore'. This enables
// easier code-splitting (via dynamic import of this module) and keeps low-level
// SDK usage consolidated per project conventions.

import { db } from "@/config/firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  deleteDoc,
  FirestoreError,
  getDoc,
  where,
  getDocs,
  addDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

// Real-time listener for a single tournament document.
export function onTournament(
  id: string,
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void
) {
  const ref = doc(db, "tournaments", id);
  return onSnapshot(ref, next, error);
}

// Real-time listener for tournament registrations (ordered by registeredAt asc).
export function onTournamentRegistrations(
  tournamentId: string,
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void
) {
  const col = collection(db, "tournaments", tournamentId, "registrations");
  const q = query(col, orderBy("registeredAt", "asc"));
  return onSnapshot(q, next, error);
}

// Real-time listener for all tournaments ordered by date.
export function onAllTournaments(
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void
) {
  const col = collection(db, "tournaments");
  const q = query(col, orderBy("date", "asc"));
  return onSnapshot(q, next, error);
}

// Delete a tournament by id.
export async function deleteTournament(id: string) {
  await deleteDoc(doc(db, "tournaments", id));
}

// Utility to transform raw Firestore snapshot doc to Tournament shape (lightweight, no import cycle).
export function mapTournamentDoc(d: any) {
  const data: any = d.data();
  const dateField =
    data.date && typeof data.date.toDate === "function"
      ? data.date.toDate()
      : data.date
        ? new Date(data.date)
        : new Date();
  const status: TournamentStatus = getStatus({
    status: data.status as TournamentStatus | undefined,
  });
  return {
    firestoreId: d.id,
    title: data.title,
    date: dateField,
    description: data.description,
    detailsMarkdown: data.detailsMarkdown || data.details || "",
    players: data.players,
    status,
    icon: data.icon,
    href: data.href,
    prizePool: data.prizePool || 0,
    winnerGroups: data.winnerGroups || [],
    tee: data.tee || "Mixed",
    assignedTeeTimes: Boolean(data.assignedTeeTimes),
    maxTeams: typeof data.maxTeams === "number" ? data.maxTeams : undefined,
    previousTournamentId: data.previousTournamentId,
    weather: data.weather,
  };
}

// One-off fetch for a single tournament (non real-time) used in register flow.
export async function fetchTournament(id: string) {
  const ref = doc(db, "tournaments", id);
  const snap = await getDoc(ref);
  return snap.exists()
    ? mapTournamentDoc({ id: snap.id, data: () => snap.data() })
    : null;
}

// Fetch an existing registration for a user (first match) or null.
export async function fetchUserRegistration(tournamentId: string, uid: string) {
  const col = collection(db, "tournaments", tournamentId, "registrations");
  const q = query(col, where("ownerId", "==", uid));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  const d = snaps.docs[0];
  return { id: d.id, ...(d.data() ?? {}) };
}

export interface RegistrationMember {
  id: string;
  displayName: string;
}
export interface RegistrationPayload {
  team: RegistrationMember[];
  ownerId: string;
}

// Create or update a registration. If registrationId provided, merges; else adds.
export async function upsertRegistration(
  tournamentId: string,
  registrationId: string | null,
  payload: RegistrationPayload
) {
  const base = {
    ...payload,
    registeredAt: serverTimestamp(),
  };
  if (registrationId) {
    const ref = doc(
      db,
      "tournaments",
      tournamentId,
      "registrations",
      registrationId
    );
    await setDoc(ref, base, { merge: true });
    return registrationId;
  }
  const col = collection(db, "tournaments", tournamentId, "registrations");
  const created = await addDoc(col, base);
  return created.id;
}

export async function deleteRegistration(
  tournamentId: string,
  registrationId: string
) {
  const ref = doc(
    db,
    "tournaments",
    tournamentId,
    "registrations",
    registrationId
  );
  await deleteDoc(ref);
}

// Fetch all registrations for a tournament (non real-time) used for conflict detection
export async function fetchAllRegistrations(tournamentId: string) {
  const colRef = collection(db, "tournaments", tournamentId, "registrations");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
}
