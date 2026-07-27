import { useEffect, useState } from "react";
import {
  onAdminDoc,
  onUserDoc,
  onUsersCollection,
  onAllFCMTokens,
} from "@/api/membershipData";
import type { User as DirectoryUser } from "@/api/users";
import type {
  DocumentData,
  DocumentSnapshot,
  FirestoreError,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "firebase/firestore";

// Admin status hook - checks Firestore admin doc
export function useAdminFlag(user: { uid?: string } | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(!!user);
  useEffect(() => {
    if (!user?.uid) {
      setIsAdmin(false);
      setLoadingAdmin(false);
      return;
    }
    const unsub = onAdminDoc(
      user.uid,
      (snap: DocumentSnapshot<DocumentData>) => {
        const d = snap.data();
        const flag =
          d?.isAdmin === true || d?.admin === true || d?.admin === "true";
        setIsAdmin(flag);
        setLoadingAdmin(false);
      },
    );
    return () => unsub();
  }, [user?.uid]);
  return { isAdmin, loadingAdmin };
}

/**
 * Hook to track which users have at least one registered FCM token.
 * Only intended for admin use; returns a Set of UIDs.
 */
export function useMembersPushStatus(enabled: boolean) {
  const [pushEnabledUids, setPushEnabledUids] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setPushEnabledUids(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);
    // Subscribe to all FCM tokens (collection group)
    const unsub = onAllFCMTokens(
      (snap) => {
        const uids = new Set<string>();
        snap.forEach((doc) => {
          // Path is users/{uid}/fcmTokens/{tokenId}
          const pathSegments = doc.ref.path.split("/");
          const uid = pathSegments[1];
          if (uid) uids.add(uid);
        });
        setPushEnabledUids(uids);
        setLoading(false);
      },
      (err) => {
        console.error("[useMembersPushStatus] snapshot error", err);
        setPushEnabledUids(new Set());
        setLoading(false);
      },
    );

    return () => unsub();
  }, [enabled]);

  return { pushEnabledUids, loading };
}

// Hook: useBoardMemberFlag - real-time subscription to the user's boardMember field.
// The field is admin-write-only per Firestore rules, so this is safe to trust.
export function useBoardMemberFlag(user: { uid?: string } | null) {
  const [isBoardMember, setIsBoardMember] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(!!user);
  useEffect(() => {
    if (!user?.uid) {
      setIsBoardMember(false);
      setLoadingBoard(false);
      return;
    }
    const unsub = onUserDoc(user.uid, (snap) => {
      const d = snap.data();
      setIsBoardMember(d?.boardMember === true);
      setLoadingBoard(false);
    });
    return () => unsub();
  }, [user?.uid]);
  return { isBoardMember, loadingBoard };
}

// Hook: useMembersSubscription - subscribes to users collection when enabled
export function useMembersSubscription(enabled: boolean) {
  const [members, setMembers] = useState<DirectoryUser[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const toError = (err: unknown): Error => {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    return new Error("Unknown error");
  };

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      setLoadingMembers(false);
      return;
    }
    const unsub = onUsersCollection(
      (snap: QuerySnapshot<DocumentData>) => {
        const arr: DirectoryUser[] = [];
        snap.forEach((d: QueryDocumentSnapshot<DocumentData>) => {
          const userData = d.data() as Omit<DirectoryUser, "id">;
          // Filter out migrated users (soft deleted)
          if (userData?.isMigrated === true) return;
          arr.push({ id: d.id, ...userData });
        });
        arr.sort((a, b) => {
          const lastA = (a.lastName || "").toLowerCase();
          const lastB = (b.lastName || "").toLowerCase();
          if (lastA !== lastB) return lastA < lastB ? -1 : 1;
          const firstA = (a.firstName || "").toLowerCase();
          const firstB = (b.firstName || "").toLowerCase();
          if (firstA !== firstB) return firstA < firstB ? -1 : 1;
          // fallback: displayName or email
          const A = (a.displayName || a.email || "").toLowerCase();
          const B = (b.displayName || b.email || "").toLowerCase();
          return A < B ? -1 : A > B ? 1 : 0;
        });
        setMembers(arr);
        setLoadingMembers(false);
      },
      (err: FirestoreError) => {
        console.error("[useMembersSubscription] snapshot error", err);
        setError(toError(err));
        setMembers([]);
        setLoadingMembers(false);
      },
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
      r.boardMember === true || (typeof r.role === "string" && r.role.trim()),
  );
  if (invalidBoard)
    return { ok: false, error: "Bulk upload cannot assign board roles" };
  const missing = rows.filter((r) => !r.email?.trim());
  if (missing.length)
    return { ok: false, error: `${missing.length} row(s) missing email` };
  return { ok: true };
}
