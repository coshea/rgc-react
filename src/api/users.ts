import { db } from "@/config/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";

export type UserProfilePayload = {
  name?: string;
  email?: string;
  phone?: string;
  ghinNumber?: string;
  photoURL?: string | null;
};

/**
 * Save or merge a user profile to users/{uid}
 */
export async function saveUserProfile(uid: string, data: UserProfilePayload) {
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  } as Record<string, any>;

  return setDoc(doc(db, "users", uid), payload, { merge: true });
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
