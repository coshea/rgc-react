// Centralized low-level Firestore access for membership directory & admin flag.
// Components/hooks should import from this module instead of '@/config/firebase'.

import { db } from "@/config/firebase";
import {
  doc,
  onSnapshot,
  collection,
  type DocumentData,
  type DocumentSnapshot,
  type FirestoreError,
  type QuerySnapshot,
} from "firebase/firestore";

export function onAdminDoc(
  uid: string,
  next: (snap: DocumentSnapshot<DocumentData>) => void,
  error?: (error: FirestoreError) => void
) {
  return onSnapshot(doc(db, "admin", uid), next, error);
}

/**
 * Subscribe to users collection, excluding migrated users.
 * Migrated users have isMigrated=true and should be hidden (soft deleted).
 * Note: We don't use where("isMigrated", "!=", true) because that excludes
 * documents where the field doesn't exist. Instead, we rely on client-side
 * filtering to exclude only documents where isMigrated === true.
 */
export function onUsersCollection(
  next: (snap: QuerySnapshot<DocumentData>) => void,
  error?: (error: FirestoreError) => void
) {
  // Return all users - filtering for isMigrated will happen client-side
  // This is because Firestore inequality queries exclude documents without the field
  return onSnapshot(collection(db, "users"), next, error);
}
