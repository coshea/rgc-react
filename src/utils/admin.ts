import { db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * One-shot admin check via Firestore admin doc.
 * Returns true if /admin/{uid} has isAdmin or admin flag set to true.
 */
export async function isAdminUser(
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
 * Convenience helper that throws if not admin; for guarding imperative flows.
 */
export async function requireAdmin(
  uid: string | undefined | null
): Promise<void> {
  const ok = await isAdminUser(uid);
  if (!ok) throw new Error("Not authorized: admin status required.");
}

/**
 * React hook for admin status - use this instead of isAdminUser in components.
 * Re-exported from @/components/membership/hooks for convenience.
 */
export { useAdminFlag } from "@/components/membership/hooks";
