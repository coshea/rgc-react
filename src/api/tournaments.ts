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
  collectionGroup,
  query,
  orderBy,
  deleteDoc,
  FirestoreError,
  getDoc,
  where,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getCountFromServer,
  QueryDocumentSnapshot,
  DocumentData,
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
    registrationOpeningNotificationEnabled:
      data.registrationOpeningNotificationEnabled !== false,
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
  // memberIds is a derived flat array of team member IDs stored alongside the
  // registration to enable efficient collectionGroup queries (array-contains).
  const memberIds = payload.team.map((m) => m.id);

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
    await setDoc(ref, { ...payload, memberIds }, { merge: true });
    return registrationId;
  }

  const col = collection(db, "tournaments", tournamentId, "registrations");
  const created = await addDoc(col, {
    ...payload,
    memberIds,
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

// ── User upcoming registrations ───────────────────────────────────────────────

export interface UserRegistrationWithTournament {
  registration: {
    id: string;
    ownerId: string;
    team: RegistrationMember[];
    openSpotsOptIn?: boolean;
    registeredAt?: Date;
  };
  tournament: ReturnType<typeof mapTournamentDoc>;
}

/**
 * Fetch upcoming tournaments where the given user is registered (as owner or
 * team member). Uses collectionGroup queries to avoid the N+1 pattern of
 * scanning all registrations for every tournament.
 *
 * "Upcoming" means the tournament
 * has not been manually marked Completed or Canceled.
 *
 * Results are sorted by tournament date ascending.
 */
export async function fetchUserUpcomingRegistrations(
  uid: string,
): Promise<UserRegistrationWithTournament[]> {
  // Two targeted collectionGroup queries replace the old N+1 pattern.
  // Query 1: registrations where the user is the captain/owner.
  // Query 2: registrations where the user appears in the memberIds array
  //          (populated by upsertRegistration for all new/updated registrations).
  const [ownedSnaps, memberSnaps] = await Promise.all([
    getDocs(
      query(collectionGroup(db, "registrations"), where("ownerId", "==", uid)),
    ),
    getDocs(
      query(
        collectionGroup(db, "registrations"),
        where("memberIds", "array-contains", uid),
      ),
    ),
  ]);

  // Merge results, deduplicating by full document path so that registrations
  // from different tournaments with the same document ID are never conflated.
  const regDocsById = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  for (const d of [...ownedSnaps.docs, ...memberSnaps.docs]) {
    regDocsById.set(d.ref.path, d);
  }

  if (regDocsById.size === 0) return [];

  // Fetch only the specific tournament documents referenced by those
  // registrations (typically 2-3 documents total).
  const regDocsList = Array.from(regDocsById.values());
  const tournamentSnaps = await Promise.all(
    regDocsList.map((regDoc) => {
      const tournamentId = regDoc.ref.parent.parent?.id;
      return tournamentId
        ? getDoc(doc(db, "tournaments", tournamentId))
        : Promise.resolve(null);
    }),
  );

  const results: UserRegistrationWithTournament[] = [];

  for (let i = 0; i < regDocsList.length; i++) {
    const tSnap = tournamentSnaps[i];
    if (!tSnap || !tSnap.exists()) continue;

    const tournament = mapTournamentDoc(tSnap);

    // Only include tournaments where registration window is open or has passed
    // but the tournament has not been completed/canceled yet.
    if (
      tournament.status === TournamentStatus.Completed ||
      tournament.status === TournamentStatus.Canceled
    ) {
      continue;
    }

    const regDoc = regDocsList[i];
    const regData = regDoc.data();
    const team = Array.isArray(regData.team)
      ? (regData.team as RegistrationMember[])
      : [];
    const ownerId = typeof regData.ownerId === "string" ? regData.ownerId : uid;
    const openSpotsOptIn =
      typeof regData.openSpotsOptIn === "boolean"
        ? regData.openSpotsOptIn
        : undefined;

    results.push({
      registration: {
        id: regDoc.id,
        ownerId,
        team,
        openSpotsOptIn,
        registeredAt: parseToDate(regData.registeredAt),
      },
      tournament,
    });
  }

  return results.sort(
    (a, b) => a.tournament.date.getTime() - b.tournament.date.getTime(),
  );
}
