import { db, auth } from "@/config/firebase";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

export type UserProfilePayload = {
  displayName?: string;
  email?: string;
  phone?: string;
  ghinNumber?: string;
  photoURL?: string | null;
  // admin only flags managed in Firestore only; client should not expose this in forms
  admin?: boolean;
  active?: boolean;
  registered?: boolean;
  // board governance fields
  boardMember?: boolean; // true if on Board of Governors
  role?: string; // e.g. 'president', 'secretary', 'treasurer'
};

export type User = UserProfilePayload & {
  id: string;
};

/**
 * Save or merge a user profile to users/{uid}
 */
export async function saveUserProfile(uid: string, data: UserProfilePayload) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  } as Record<string, any>;

  // Basic client-side sanity check: ensure the currently signed-in user
  // matches the UID we're attempting to write. This doesn't replace
  // Firestore security rules, but it gives a clearer error when the
  // client is not authenticated or using the wrong UID.
  const currentUid = auth.currentUser?.uid ?? null;
  if (!currentUid) {
    throw new Error(
      "Cannot save user profile: no authenticated user found (auth.currentUser is null)."
    );
  }

  if (currentUid !== uid) {
    throw new Error(
      `Cannot save user profile: authenticated UID (${currentUid}) does not match requested UID (${uid}).`
    );
  }

  try {
    return await setDoc(doc(db, "users", uid), payload, { merge: true });
  } catch (err: any) {
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
      // @ts-ignore
      e.original = err;
      throw e;
    }
    throw err;
  }
}

export async function getUserProfile(
  uid: string
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
  // Return users ordered by displayName for predictable alphabetical listing
  const q = query(usersCol, orderBy("displayName", "asc"));
  const userSnapshot = await getDocs(q);
  const userList = userSnapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as User[];
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
  data: Partial<UserProfilePayload>
) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

/** Admin-only: delete a user profile document. */
export async function deleteUser(uid: string) {
  const ref = doc(db, "users", uid);
  await deleteDoc(ref);
}

/**
 * Bulk create user documents (admin-only pathway). Uses Firestore write batches
 * with a max of 500 operations per batch. Each payload is sanitized to ensure
 * string fields are at least empty strings (preventing undefined fields when
 * UI expects string). Board / role fields are passed through verbatim; security
 * rules will enforce validity.
 *
 * Returns total number of documents attempted. Throws on the first batch error.
 */
export async function bulkCreateUsers(
  rows: UserProfilePayload[]
): Promise<number> {
  if (!rows.length) return 0;

  // Firestore limitation: 500 writes per batch
  const MAX = 500;
  let processed = 0;
  for (let i = 0; i < rows.length; i += MAX) {
    const slice = rows.slice(i, i + MAX);
    const batch = writeBatch(db);
    slice.forEach((r) => {
      const ref = doc(collection(db, "users"));
      const payload: Record<string, any> = {
        displayName: r.displayName || "",
        email: r.email || "",
        phone: r.phone || "",
        ghinNumber: r.ghinNumber || "",
        photoURL: r.photoURL ?? null,
      };
      if (typeof r.active === "boolean") payload.active = r.active;
      if (typeof r.registered === "boolean") payload.registered = r.registered;
      if (typeof r.boardMember === "boolean")
        payload.boardMember = r.boardMember;
      if (r.role) payload.role = r.role;
      payload.createdAt = serverTimestamp();
      payload.updatedAt = serverTimestamp();
      batch.set(ref, payload);
    });
    try {
      await batch.commit();
      processed += slice.length;
    } catch (err: any) {
      // Provide granular diagnostics by retrying each write individually.
      console.error(
        "[bulkCreateUsers] Batch commit failed — attempting per-row isolation",
        err
      );
      const perRowErrors: { index: number; reason: string }[] = [];
      let successfulThisSlice = 0;
      for (let localIdx = 0; localIdx < slice.length; localIdx++) {
        const r = slice[localIdx];
        try {
          const ref = doc(collection(db, "users"));
          const payload: Record<string, any> = {
            displayName: r.displayName || "",
            email: r.email || "",
            phone: r.phone || "",
            ghinNumber: r.ghinNumber || "",
            photoURL: r.photoURL ?? null,
          };
          if (typeof r.active === "boolean") payload.active = r.active;
          if (typeof r.registered === "boolean")
            payload.registered = r.registered;
          if (typeof r.boardMember === "boolean")
            payload.boardMember = r.boardMember;
          if (r.role) payload.role = r.role;
          payload.createdAt = serverTimestamp();
          payload.updatedAt = serverTimestamp();
          await setDoc(ref, payload);
          successfulThisSlice++;
        } catch (rowErr: any) {
          const code = rowErr?.code || rowErr?.message || "unknown";
          // Common pattern detection for clarity
          let reason = String(code);
          if (code === "permission-denied") {
            if (!auth.currentUser) {
              reason = "permission-denied (unauthenticated)";
            } else {
              reason =
                "permission-denied (rules rejection: likely not admin or email missing)";
            }
          } else if (/missing|email/i.test(code) && !slice[localIdx].email) {
            reason = "missing-email";
          }
          perRowErrors.push({ index: i + localIdx, reason });
        }
      }
      processed += successfulThisSlice;
      if (perRowErrors.length) {
        const summary = {
          attempted: slice.length,
          succeeded: successfulThisSlice,
          failed: perRowErrors.length,
          errors: perRowErrors.slice(0, 10), // limit log volume
        };
        console.error("[bulkCreateUsers] Partial failures", summary);
        // Throw aggregated error so caller can surface succinct message
        const errMsg = `Bulk create partially failed: ${successfulThisSlice}/${slice.length} succeeded. First errors: ${perRowErrors
          .slice(0, 5)
          .map((e) => `#${e.index}:${e.reason}`)
          .join(", ")}`;
        const aggregate = new Error(errMsg);
        // @ts-ignore attach metadata
        aggregate.details = summary;
        throw aggregate;
      }
    }
  }
  return processed;
}
