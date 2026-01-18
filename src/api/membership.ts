import { db, auth } from "@/config/firebase";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { logFsStart, logFsSuccess, logFsError } from "@/utils/firestoreLogger";
import type { MembershipSettings } from "@/types/membershipSettings";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";

export type MembershipPayment = {
  userId: string;
  year: number;
  paidAt: any; // Firestore Timestamp
  amount?: number | null;
  method?: string | null; // 'stripe' | 'cash' | 'check' | 'comp'
  membershipType: "full" | "handicap";
  recordedBy?: string | null;
  status: "confirmed" | "pending" | "refunded";
};

function paymentDocId(userId: string, year: number) {
  return `${userId}_${year}`;
}

/** Idempotent creation of a membership payment record plus denormalized user update */
export async function recordMembershipPayment(params: {
  userId: string;
  year: number;
  membershipType: "full" | "handicap";
  amount?: number;
  method?: string;
  status?: "confirmed" | "pending";
}) {
  const { userId, year, membershipType, amount, method } = params;
  const status = params.status ?? "confirmed";
  const id = paymentDocId(userId, year);
  const ref = doc(db, "memberPayments", id);
  logFsStart("recordMembershipPayment", { userId, year, membershipType });
  const existing = await getDoc(ref);
  if (existing.exists()) {
    logFsSuccess("recordMembershipPayment", { userId, year, reused: true });
    return; // idempotent
  }
  try {
    await setDoc(ref, {
      userId,
      year,
      paidAt: serverTimestamp(),
      amount: amount ?? null,
      method: method ?? null,
      membershipType,
      recordedBy: auth.currentUser?.uid ?? null,
      status,
    });
    // denormalized update on user doc
    await setDoc(
      doc(db, "users", userId),
      {
        lastPaidYear: year,
        membershipType,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    logFsSuccess("recordMembershipPayment", { userId, year });
  } catch (error) {
    logFsError("recordMembershipPayment", error, { userId, year });
    throw error;
  }
}

/** Fetch all payment docs for a given year and return Set of userIds */
export async function getActiveMemberIdsForYear(
  year: number
): Promise<Set<string>> {
  const q = query(
    collection(db, "memberPayments"),
    where("year", "==", year),
    where("status", "==", "confirmed")
  );
  const snap = await getDocs(q);
  const ids = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as MembershipPayment;
    if (data.userId) ids.add(data.userId);
  });
  return ids;
}

/** Return all membership payment history for a user (descending by year) */
export async function getMembershipHistory(
  userId: string
): Promise<MembershipPayment[]> {
  const paymentsCol = collection(db, "memberPayments");
  const q = query(paymentsCol, where("userId", "==", userId));
  const snap = await getDocs(q);
  const rows: MembershipPayment[] = [];
  snap.forEach((docSnap) => {
    rows.push(docSnap.data() as MembershipPayment);
  });
  rows.sort((a, b) => b.year - a.year);
  return rows;
}

/** Get payment doc for a user for a specific year (if exists) */
export async function getMembershipPayment(
  userId: string,
  year: number
): Promise<MembershipPayment | null> {
  const id = paymentDocId(userId, year);
  const ref = doc(db, "memberPayments", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as MembershipPayment;
}

/** Update membership payment fields (admin). */
export async function updateMembershipPayment(params: {
  userId: string;
  year: number;
  updates: Partial<
    Pick<MembershipPayment, "amount" | "method" | "membershipType" | "status">
  >;
}): Promise<{ created?: boolean; confirmed?: boolean }> {
  const { userId, year, updates } = params;
  const id = paymentDocId(userId, year);
  const ref = doc(db, "memberPayments", id);
  logFsStart("updateMembershipPayment", { userId, year });
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    // CREATE path: permit creating either confirmed OR pending record when membershipType provided.
    if (updates.membershipType) {
      const status: MembershipPayment["status"] =
        updates.status === "confirmed" ||
        updates.status === "pending" ||
        updates.status === "refunded"
          ? updates.status
          : "pending";
      const confirmedCreate = status === "confirmed";
      // Build base payload (paidAt only when confirmed)
      const payload: Partial<MembershipPayment> & {
        userId: string;
        year: number;
      } = {
        userId,
        year,
        membershipType: updates.membershipType,
        status,
        paidAt: confirmedCreate ? serverTimestamp() : null,
        amount: updates.amount == null ? null : updates.amount,
        method:
          updates.method == null || updates.method === ""
            ? null
            : updates.method,
        recordedBy: auth.currentUser?.uid ?? null,
      };
      await setDoc(ref, payload);
      // denormalize membershipType always; lastPaidYear only when confirmed
      await setDoc(
        doc(db, "users", userId),
        {
          membershipType: updates.membershipType,
          ...(confirmedCreate ? { lastPaidYear: year } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      logFsSuccess("updateMembershipPayment", {
        userId,
        year,
        created: true,
        status,
      });
      return { created: true, confirmed: confirmedCreate };
    }
    throw new Error(
      "Membership payment record does not exist and no membershipType provided to create"
    );
  }
  try {
    const payload: any = { ...updates, updatedAt: serverTimestamp() };
    // Normalize undefined -> null or delete for Firestore compatibility
    if (payload.amount === undefined) delete payload.amount;
    if (payload.method === undefined || payload.method === "")
      payload.method = null;
    if (payload.membershipType === undefined) delete payload.membershipType;
    if (payload.status === undefined) delete payload.status;
    await setDoc(ref, payload, { merge: true });
    if (updates.membershipType || updates.status === "confirmed") {
      await setDoc(
        doc(db, "users", userId),
        {
          ...(updates.membershipType
            ? { membershipType: updates.membershipType }
            : {}),
          ...(updates.status === "confirmed" ? { lastPaidYear: year } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    const confirmed = updates.status === "confirmed";
    logFsSuccess("updateMembershipPayment", { userId, year });
    return { confirmed };
  } catch (e) {
    logFsError("updateMembershipPayment", e, { userId, year });
    throw e;
  }
}

// ============================================================================
// Membership Settings (Admin Controls)
// ============================================================================

/**
 * Get current membership settings (pricing, registration open/closed)
 * Returns default settings if document doesn't exist
 */
export async function getMembershipSettings(): Promise<MembershipSettings> {
  const ref = doc(db, "config", "membershipSettings");
  logFsStart("getMembershipSettings");
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      logFsSuccess("getMembershipSettings", { source: "default" });
      return DEFAULT_MEMBERSHIP_SETTINGS;
    }
    const data = snap.data() as MembershipSettings;
    logFsSuccess("getMembershipSettings", {
      registrationOpen: data.registrationOpen,
    });
    return data;
  } catch (e) {
    const errorCode =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code?: unknown }).code
        : undefined;
    if (errorCode === "permission-denied") {
      logFsSuccess("getMembershipSettings", {
        source: "default",
        reason: "permission-denied",
      });
      return DEFAULT_MEMBERSHIP_SETTINGS;
    }
    logFsError("getMembershipSettings", e);
    throw e;
  }
}

/**
 * Subscribe to membership settings changes in real-time
 */
export function subscribeMembershipSettings(
  callback: (settings: MembershipSettings) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const ref = doc(db, "config", "membershipSettings");
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_MEMBERSHIP_SETTINGS);
      } else {
        callback(snap.data() as MembershipSettings);
      }
    },
    (error) => {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;

      // For logged-out users, rules may deny reading config. In that case,
      // fall back to defaults so the membership flow can still render.
      if (errorCode === "permission-denied") {
        callback(DEFAULT_MEMBERSHIP_SETTINGS);
        logFsSuccess("subscribeMembershipSettings", {
          source: "default",
          reason: "permission-denied",
        });
        return;
      }

      // For other errors, prefer to let the caller decide how to handle it
      // (e.g. surface an offline/error state in the UI). If the caller did
      // not provide an onError handler, fall back to returning defaults.
      if (typeof onError === "function") {
        onError(error);
        return;
      }

      callback(DEFAULT_MEMBERSHIP_SETTINGS);
      logFsError("subscribeMembershipSettings", error);
    }
  );
}

/**
 * Update membership settings (admin only)
 * @throws Error if user is not authenticated
 */
export async function updateMembershipSettings(
  settings: Partial<Omit<MembershipSettings, "updatedAt" | "updatedBy">>
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Must be authenticated to update membership settings");
  }

  const ref = doc(db, "config", "membershipSettings");
  logFsStart("updateMembershipSettings", settings);

  try {
    await setDoc(
      ref,
      {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      },
      { merge: true }
    );
    logFsSuccess("updateMembershipSettings");
  } catch (e) {
    logFsError("updateMembershipSettings", e);
    throw e;
  }
}
