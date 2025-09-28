// Centralized low-level Firestore access for membership directory & admin flag.
// Components/hooks should import from this module instead of '@/config/firebase'.

import { db } from "@/config/firebase";
import { doc, onSnapshot, collection } from "firebase/firestore";

export function onAdminDoc(uid: string, next: (snap: any) => void) {
  return onSnapshot(doc(db, "admin", uid), next);
}

export function onUsersCollection(
  next: (snap: any) => void,
  error?: (e: any) => void
) {
  return onSnapshot(collection(db, "users"), next, error);
}
