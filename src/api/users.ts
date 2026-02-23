import { db, auth } from "@/config/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import type { MembershipType } from "@@/types";

// Utility type for Firestore timestamp fields that can be either Timestamp or Date
export type FirestoreTimestamp = Timestamp | Date;

/**
 * Utility function to safely convert Firestore timestamp to Date
 */
export function toDate(timestamp: FirestoreTimestamp | undefined): Date | null {
  if (!timestamp) return null;

  // If it's a Firestore Timestamp, use toDate() method
  if (timestamp && typeof timestamp === "object" && "toDate" in timestamp) {
    return timestamp.toDate();
  }

  // If it's already a Date, return it
  if (timestamp instanceof Date) {
    return timestamp;
  }

  return null;
}

/**
 * Canonical shape of user profile data persisted in `users/{uid}` (or created via admin bulk tools).
 * All fields are optional for partial updates; Firestore merges treat `undefined` as "do not change".
 *
 * Field semantics:
 * - firstName / lastName: Raw name components as entered. Leading/trailing whitespace trimmed on writes.
 * - displayName: Derived friendly name. Computed from first+last when either supplied; may fall back to existing value.
 *   Avoid setting manually unless importing legacy data.
 * - email: Primary contact + identity fallback when no name; required for login‑based flows.
 * - phone: Normalized phone string (see format helpers) used for directory and contact; optional.
 * - ghinNumber: External GHIN / handicap system identifier.
 * - photoURL: Avatar image URL (Firebase Storage or external); null indicates explicit removal.
 * - boardMember: True if serving on the Board of Governors (governs visibility of role and directory highlighting).
 * - role: Normalized board role string (validated against ALLOWED_BOARD_ROLES elsewhere). Null/empty when not a board member.
 * - membershipType: Current membership classification. 'full' grants full tournament privileges; 'handicap' limited scope.
 * - lastPaidYear: Highest year (e.g. 2025) for which a confirmed (paid) membership payment record exists; used for active season gating.
 * - isMigrated: Boolean flag indicating this user has been merged into another user and should be hidden from all queries (soft delete).
 * - migrationEligible: Boolean flag indicating this user can be considered for migration/merge workflows.
 */
export type UserProfilePayload = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  ghinNumber?: string;
  photoURL?: string | null;
  boardMember?: boolean;
  role?: string;
  membershipType?: MembershipType;
  lastPaidYear?: number;
  isMigrated?: boolean;
  migrationEligible?: boolean;
};

export type User = UserProfilePayload & {
  id: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
};

/** Create a new user document (admin action). */
export async function createUser(data: UserProfilePayload) {
  const first = (data.firstName || "").trim();
  const last = (data.lastName || "").trim();

  // Compute displayName from first + last names
  const displayName = computeDisplayName(data);

  const payload: Record<string, any> = {
    firstName: first || undefined,
    lastName: last || undefined,
    displayName: displayName || undefined,
    email: data.email || "",
    phone: data.phone || "",
    ghinNumber: data.ghinNumber || "",
    photoURL: data.photoURL ?? null,
    boardMember: !!data.boardMember,
    role: data.boardMember ? data.role || null : null,
    migrationEligible: data.migrationEligible ?? false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return await addDoc(collection(db, "users"), payload);
}

/**
 * Utility: derive a normalized display name from first + last names.
 * Falls back to existing displayName value if first/last not provided.
 * Collapses internal whitespace and trims.
 */
export function computeDisplayName(
  data: Pick<UserProfilePayload, "firstName" | "lastName" | "displayName">,
): string {
  const first = (data.firstName || "").trim();
  const last = (data.lastName || "").trim();
  if (first || last) {
    return [first, last].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  return (data.displayName || "").trim();
}

/**
 * Save or merge a user profile to users/{uid}
 */
export async function saveUserProfile(uid: string, data: UserProfilePayload) {
  // Derive displayName from first + last if provided (trim + collapse spaces)
  const computedDisplay = computeDisplayName(data);
  if (computedDisplay) data.displayName = computedDisplay;

  // Create payload and explicitly exclude board fields for security
  // Only admins should be able to set these fields
  const { boardMember: _boardMember, role: _role, ...safeData } = data;
  const payload = {
    ...safeData,
    updatedAt: serverTimestamp(),
  } as Record<string, any>;

  // Basic client-side sanity check: ensure the currently signed-in user
  // matches the UID we're attempting to write. This doesn't replace
  // Firestore security rules, but it gives a clearer error when the
  // client is not authenticated or using the wrong UID.
  const currentUid = auth.currentUser?.uid ?? null;
  if (!currentUid) {
    throw new Error(
      "Cannot save user profile: no authenticated user found (auth.currentUser is null).",
    );
  }

  if (currentUid !== uid) {
    throw new Error(
      `Cannot save user profile: authenticated UID (${currentUid}) does not match requested UID (${uid}).`,
    );
  }

  // Firestore rules require a non-empty email when creating users/{uid}.
  // If caller didn't provide one (common for profile edits), fall back to the
  // authenticated Firebase user's email so first-write bootstrap succeeds.
  const authEmail = (auth.currentUser?.email || "").trim();
  const payloadEmail =
    typeof payload.email === "string" ? payload.email.trim() : "";
  if (!payloadEmail && authEmail) {
    payload.email = authEmail;
  }

  const profileRef = doc(db, "users", uid);
  let profileExists = false;
  try {
    const existing = await getDoc(profileRef);
    profileExists = existing.exists();
  } catch {
    // If pre-read fails (e.g. transient token timing), continue with write path below.
    // Firestore rules remain the source of truth.
  }

  // Edge case guard: if no email is available at all and the profile doc does
  // not exist yet, the create will be denied by rules. Surface a clear error.
  if (
    !profileExists &&
    !(typeof payload.email === "string" && payload.email.trim())
  ) {
    throw new Error(
      "Cannot create profile record: no email available for users/{uid}. Please re-authenticate and ensure your account has an email address.",
    );
  }

  try {
    if (!profileExists) {
      const createPayload: Record<string, any> = {
        ...payload,
        email: payload.email,
        boardMember: false,
        role: null,
        createdAt: serverTimestamp(),
      };
      return await setDoc(profileRef, createPayload, { merge: false });
    }

    return await setDoc(profileRef, payload, { merge: true });
  } catch (err: any) {
    if (err?.code === "permission-denied") {
      // One retry after token refresh helps in rare auth-token timing races.
      try {
        await auth.currentUser?.getIdToken(true);
        if (!profileExists) {
          const retryCreatePayload: Record<string, any> = {
            ...payload,
            email: payload.email,
            boardMember: false,
            role: null,
            createdAt: serverTimestamp(),
          };
          return await setDoc(profileRef, retryCreatePayload, { merge: false });
        }
        return await setDoc(profileRef, payload, { merge: true });
      } catch {
        // Fall through to standardized error below.
      }
    }

    // Surface permission-specific information to aid debugging.
    // Don't leak sensitive internals — just annotate the error sensibly.
    if (err?.code === "permission-denied") {
      const message =
        `Firestore permission denied when writing users/${uid}. ` +
        "Check your Firestore security rules (allow write for authenticated users) and ensure App Check / auth tokens are configured if required.";
      const e = new Error(message);
      // Preserve original error on a property for deeper debugging if needed
      // but throw the new, clearer message upstream.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error attaching non-standard metadata for diagnostics
      e.original = err;
      throw e;
    }
    throw err;
  }
}

export async function getUserProfile(
  uid: string,
): Promise<UserProfilePayload | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  // Cast to UserProfilePayload (may contain additional fields like updatedAt)
  return data as unknown as UserProfilePayload;
}

export async function getUsers(): Promise<User[]> {
  const usersCol = collection(db, "users");
  // Return users ordered by displayName
  const q = query(usersCol, orderBy("displayName", "asc"));
  const userSnapshot = await getDocs(q);
  // Filter out migrated users client-side (can't use where "!=" as it excludes docs without the field)
  const userList = userSnapshot.docs
    .map(
      (docSnap) =>
        ({
          id: docSnap.id,
          ...docSnap.data(),
        }) as User,
    )
    .filter((user) => !user.isMigrated);
  // Some users may have blank/missing displayName; apply stable secondary sort by email
  userList.sort((a, b) => {
    const A = (a.displayName || a.email || "").toLowerCase();
    const B = (b.displayName || b.email || "").toLowerCase();
    if (A < B) return -1;
    if (A > B) return 1;
    return 0;
  });
  return userList;
}

/** Admin-only: update another user's profile (does not enforce auth client-side).
 * Firestore security rules must permit this (isAdmin()).
 */
export async function updateUser(
  uid: string,
  data: Partial<UserProfilePayload>,
) {
  const ref = doc(db, "users", uid);
  // If caller passed first/last (or legacy displayName), recompute.
  const computed = computeDisplayName({
    firstName: data.firstName,
    lastName: data.lastName,
    displayName: data.displayName,
  });
  const payload: Record<string, any> = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined) payload[k] = v; // avoid undefined writes (Firestore rejects)
  });
  if (computed) payload.displayName = computed;
  payload.updatedAt = serverTimestamp();
  await updateDoc(ref, payload);
}

/** Admin-only: delete a user profile document. */
export async function deleteUser(uid: string) {
  const ref = doc(db, "users", uid);
  await deleteDoc(ref);
}

/**
 * Bulk create user documents (admin-only pathway) – sequential version.
 * Replaces batched writes with per-row `addDoc` (or `setDoc` if we later need deterministic IDs).
 * Pros: simpler, clearer error attribution, avoids batch abort semantics.
 * Cons: slower (one network round trip per row) and non-atomic (partial success possible).
 *
 * Returns number of successfully created documents. If at least one row succeeds and others fail,
 * it throws an aggregated error AFTER processing all rows, attaching partial results to `error.details`.
 */
export async function bulkCreateUsers(
  rows: UserProfilePayload[],
  opts?: { onProgress?: (processed: number, total: number) => void },
): Promise<number> {
  if (!rows.length) return 0;

  const perRowErrors: { index: number; reason: string }[] = [];
  let succeeded = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const first = (r.firstName || "").trim();
      const last = (r.lastName || "").trim();
      const payload: Record<string, any> = {
        firstName: first || undefined,
        lastName: last || undefined,
        email: r.email || "",
        phone: r.phone || "",
        ghinNumber: r.ghinNumber || "",
        photoURL: r.photoURL ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (typeof r.boardMember === "boolean")
        payload.boardMember = r.boardMember;
      if (r.role) payload.role = r.role;

      console.log("[bulkCreateUsers] creating user", payload);

      await addDoc(collection(db, "users"), payload);
      succeeded++;
    } catch (err: any) {
      const code = err?.code || err?.message || "unknown";
      let reason = String(code);
      if (code === "permission-denied") {
        if (!auth.currentUser) reason = "permission-denied (unauthenticated)";
        else
          reason =
            "permission-denied (rules rejection: not admin or missing email)";
      } else if (/missing|email/i.test(code) && !r.email) {
        reason = "missing-email";
      }
      perRowErrors.push({ index: i, reason });
    }
    // invoke progress after each row (success or failure)
    opts?.onProgress?.(i + 1, rows.length);
  }

  if (perRowErrors.length) {
    const summary = {
      attempted: rows.length,
      succeeded,
      failed: perRowErrors.length,
      errors: perRowErrors.slice(0, 25),
    };
    console.error("[bulkCreateUsers] Partial/failed upload", summary);
    const errMsg =
      succeeded === 0
        ? `Bulk create failed: 0/${rows.length} succeeded. First errors: ${perRowErrors
            .slice(0, 5)
            .map((e) => `#${e.index}:${e.reason}`)
            .join(", ")}`
        : `Bulk create partially failed: ${succeeded}/${rows.length} succeeded. First errors: ${perRowErrors
            .slice(0, 5)
            .map((e) => `#${e.index}:${e.reason}`)
            .join(", ")}`;
    const aggregate = new Error(errMsg);
    // @ts-expect-error attach metadata for diagnostics
    aggregate.details = summary;
    throw aggregate;
  }

  return succeeded;
}
