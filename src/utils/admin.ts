import { db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * One-shot doc-based admin check. Ignores custom claims intentionally.
 * Returns true if /admin/{uid} has isAdmin/admin flag true (or string 'true').
 */
export async function isDocAdmin(
  uid: string | undefined | null
): Promise<boolean> {
  if (!uid) return false;
  const ref = doc(db, "admin", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const d: any = snap.data();
  return d?.isAdmin === true || d?.admin === true || d?.admin === "true";
}

/**
 * Convenience helper that throws if not doc-admin; for guarding imperative flows.
 */
export async function requireDocAdmin(
  uid: string | undefined | null
): Promise<void> {
  const ok = await isDocAdmin(uid);
  if (!ok)
    throw new Error("Not authorized: admin doc not present or not flagged.");
}
