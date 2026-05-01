import { TournamentStatus } from "@/types/tournament";
import { getStatus, parseToDate } from "@/utils/tournamentStatus";
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
  getCountFromServer,
} from "firebase/firestore";

// Real-time listener for a single tournament document.
export function onTournament(
  id: string,
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void,
) {
  const ref = doc(db, "tournaments", id);
  return onSnapshot(ref, next, error);
}

// Real-time listener for tournament registrations (ordered by registeredAt asc).
export function onTournamentRegistrations(
  tournamentId: string,
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void,
) {
  const col = collection(db, "tournaments", tournamentId, "registrations");
  const q = query(col, orderBy("registeredAt", "asc"));
  return onSnapshot(q, next, error);
}

// Real-time listener for all tournaments ordered by date.
export function onAllTournaments(
  next: (snap: any) => void,
  error?: (error: FirestoreError) => void,
) {
  const col = collection(db, "tournaments");
  const q = query(col, orderBy("date", "asc"));
  return onSnapshot(q, next, error);
}

// Delete a tournament by id.
export async function deleteTournament(id: string) {
  await deleteDoc(doc(db, "tournaments", id));
}

export function mapTournamentDoc(d: any) {
  const data: any = d.data();
  const dateField =
    data.date && typeof data.date.toDate === "function"
      ? data.date.toDate()
      : data.date
        ? new Date(data.date)
        : new Date();
  const registrationStart = parseToDate(data.registrationStart);
  const registrationEnd = parseToDate(data.registrationEnd);
  const status: TournamentStatus = getStatus({
    status: data.status as TournamentStatus | undefined,
    registrationStart,
    registrationEnd,
  });
  return {
    firestoreId: d.id,
    title: data.title,
    date: dateField,
    description: data.description,
    detailsMarkdown: data.detailsMarkdown || data.details || "",
    players: data.players,
    status,
    registrationStart,
    registrationEnd,
    icon: data.icon,
    href: data.href,
    prizePool: data.prizePool || 0,
    winnerGroups: data.winnerGroups || [],
    tee: data.tee || "Mixed",
    assignedTeeTimes: Boolean(data.assignedTeeTimes),
    maxTeams: typeof data.maxTeams === "number" ? data.maxTeams : undefined,
    previousTournamentId: data.previousTournamentId,
    weather: data.weather,
    goldTeesEnabled: Boolean(data.goldTeesEnabled),
    bracketPublished: Boolean(data.bracketPublished),
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
  /** When true, this player will play from the gold (senior) tees */
  goldTee?: boolean;
}
export interface RegistrationPayload {
  team: RegistrationMember[];
  ownerId: string;
  /** When true, the captain opts in to advertising open spots on the team. */
  openSpotsOptIn?: boolean;
}

// Create or update a registration. If registrationId provided, merges; else adds.
export async function upsertRegistration(
  tournamentId: string,
  registrationId: string | null,
  payload: RegistrationPayload,
) {
  // When creating a new registration, stamp it with the server timestamp so
  // ordering by `registeredAt` reflects the original registration time.
  // When updating an existing registration, DO NOT modify `registeredAt` to
  // preserve original ordering.
  if (registrationId) {
    const ref = doc(
      db,
      "tournaments",
      tournamentId,
      "registrations",
      registrationId,
    );
    // Merge the payload but intentionally omit `registeredAt` so the existing
    // value remains unchanged.
    await setDoc(ref, { ...payload }, { merge: true });
    return registrationId;
  }

  const col = collection(db, "tournaments", tournamentId, "registrations");
  const created = await addDoc(col, {
    ...payload,
    registeredAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteRegistration(
  tournamentId: string,
  registrationId: string,
) {
  const ref = doc(
    db,
    "tournaments",
    tournamentId,
    "registrations",
    registrationId,
  );
  await deleteDoc(ref);
}

// Fetch all registrations for a tournament (non real-time) used for conflict detection
export async function fetchAllRegistrations(tournamentId: string) {
  const colRef = collection(db, "tournaments", tournamentId, "registrations");
  const snaps = await getDocs(colRef);
  return snaps.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }));
}

// ── Looking For Team ─────────────────────────────────────────────────────────
// Sub-collection: tournaments/{tournamentId}/lookingForTeam/{uid}
// One document per user. Document ID == the user's UID.

export interface LookingForTeamPost {
  /** Firestore document ID (== ownerId) */
  id: string;
  ownerId: string;
  createdAt: Date;
}

/** Real-time listener for the lookingForTeam sub-collection. */
export function onLookingForTeam(
  tournamentId: string,
  next: (posts: LookingForTeamPost[]) => void,
  error?: (err: FirestoreError) => void,
) {
  const col = collection(db, "tournaments", tournamentId, "lookingForTeam");
  const q = query(col, orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const posts: LookingForTeamPost[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerId: data.ownerId as string,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        };
      });
      next(posts);
    },
    error,
  );
}

/** Create or overwrite the current user's "looking for team" post. */
export async function setLookingForTeamPost(tournamentId: string, uid: string) {
  const ref = doc(db, "tournaments", tournamentId, "lookingForTeam", uid);
  await setDoc(ref, {
    ownerId: uid,
    createdAt: serverTimestamp(),
  });
}

/** Delete the current user's "looking for team" post. */
export async function deleteLookingForTeamPost(
  tournamentId: string,
  uid: string,
) {
  const ref = doc(db, "tournaments", tournamentId, "lookingForTeam", uid);
  await deleteDoc(ref);
}

// Fetch only the registration count for a tournament using Firestore count aggregation.
// Much cheaper than fetchAllRegistrations — reads zero document fields.
export async function fetchRegistrationCount(
  tournamentId: string,
): Promise<number> {
  const colRef = collection(db, "tournaments", tournamentId, "registrations");
  const snap = await getCountFromServer(colRef);
  return snap.data().count;
}

/** Toggle bracket visibility for non-admin users. */
export async function setBracketPublished(
  tournamentId: string,
  published: boolean,
) {
  const ref = doc(db, "tournaments", tournamentId);
  await updateDoc(ref, { bracketPublished: published });
}
