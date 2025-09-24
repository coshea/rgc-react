import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { doc, onSnapshot, collection } from "firebase/firestore";
import type { User as DirectoryUser } from "@/api/users";

// Doc-only admin hook (ignores custom claims intentionally)
export function useDocAdminFlag(user: { uid?: string } | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(!!user);
  useEffect(() => {
    if (!user?.uid) {
      setIsAdmin(false);
      setLoadingAdmin(false);
      return;
    }
    const adminRef = doc(db, "admin", user.uid);
    const unsub = onSnapshot(adminRef, (snap) => {
      const d = snap.data();
      const flag =
        d?.isAdmin === true || d?.admin === true || d?.admin === "true";
      setIsAdmin(flag);
      setLoadingAdmin(false);
    });
    return () => unsub();
  }, [user?.uid]);
  return { isAdmin, loadingAdmin };
}

// Hook: useMembersSubscription - subscribes to users collection when enabled
export function useMembersSubscription(enabled: boolean) {
  const [members, setMembers] = useState<DirectoryUser[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }
    const usersCol = collection(db, "users");
    const unsub = onSnapshot(
      usersCol,
      (snap) => {
        const arr: DirectoryUser[] = [];
        snap.forEach((d) =>
          arr.push({ id: d.id, ...(d.data() as any) } as DirectoryUser)
        );
        arr.sort((a, b) => {
          const A = (a.displayName || a.email || "").toLowerCase();
          const B = (b.displayName || b.email || "").toLowerCase();
          if (A < B) return -1;
          if (A > B) return 1;
          return 0;
        });
        setMembers(arr);
        setLoadingMembers(false);
      },
      (err) => {
        console.error("[useMembersSubscription] snapshot error", err);
        setError(err as any);
        setMembers([]);
        setLoadingMembers(false);
      }
    );
    return () => unsub();
  }, [enabled]);

  return { members, loadingMembers, error };
}

// Helper: preflight CSV validation extracted (mirrors logic in page for testing)
import type { UserProfilePayload } from "@/api/users";
export interface CsvPreflightResult {
  ok: boolean;
  error?: string;
}
export function preflightCsv(rows: UserProfilePayload[]): CsvPreflightResult {
  if (!rows.length) return { ok: false, error: "No rows" };
  const invalidBoard = rows.some(
    (r) =>
      (r as any).boardMember === true ||
      (typeof (r as any).role === "string" && (r as any).role.trim())
  );
  if (invalidBoard)
    return { ok: false, error: "Bulk upload cannot assign board roles" };
  const missing = rows.filter((r) => !r.email?.trim());
  if (missing.length)
    return { ok: false, error: `${missing.length} row(s) missing email` };
  return { ok: true };
}
