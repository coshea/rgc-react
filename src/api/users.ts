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
} from "firebase/firestore";

export type UserProfilePayload = {
  displayName?: string;
  email?: string;
  phone?: string;
  ghinNumber?: string;
  photoURL?: string | null;
  // admin flag is managed in Firestore only; client should not expose this in forms
  admin?: boolean;
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
  const userList = userSnapshot.docs.map((doc) => {
    return {
      id: doc.id,
      ...doc.data(),
    } as User;
  });
  return userList;
}
