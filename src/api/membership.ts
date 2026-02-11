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
  writeBatch,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseFunctionsBaseUrl } from "@/api/functionsBase";
import { logFsStart, logFsSuccess, logFsError } from "@/utils/firestoreLogger";
import type { MembershipSettings } from "@/types/membershipSettings";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";
import type { MembershipType } from "@/types/membership";

export type MembershipPayment = {
  id?: string;
  userId: string;
  year: number;
  createdAt?: any; // Firestore Timestamp
  paidAt: any; // Firestore Timestamp
  amount?: number | null;
  method?: string | null; // 'stripe' | 'cash' | 'check' | 'comp'
  membershipType?: MembershipType | null;
  recordedBy?: string | null;
  status: "confirmed" | "pending" | "refunded";
  purpose?: "dues" | "donation";
  groupId?: string | null;
};

export type PayPalReconcileResponse = {
  ok: boolean;
  scanned: number;
  processed: number;
  skipped: number;
  skippedItems: Array<{
    orderId?: string | null;
    customId?: string | null;
    reason: string;
  }>;
  errors: Array<{
    orderId?: string | null;
    customId?: string | null;
    error: string;
  }>;
  error?: string;
};

/** Create a membership payment record plus denormalized user update */
export async function recordMembershipPayment(params: {
  userId: string;
  year: number;
  membershipType: MembershipType;
  amount?: number;
  method?: string;
  status?: "confirmed" | "pending";
  purpose?: "dues" | "donation";
  groupId?: string;
  paymentId?: string;
}) {
  const {
    userId,
    year,
    membershipType,
    amount,
    method,
    purpose,
    groupId,
    paymentId,
  } = params;
  const status = params.status ?? "confirmed";
  const resolvedPurpose = purpose ?? "dues";
  const isConfirmed = status === "confirmed";
  const isDues = resolvedPurpose === "dues";
  const ref = paymentId
    ? doc(db, "memberPayments", paymentId)
    : doc(collection(db, "memberPayments"));
  logFsStart("recordMembershipPayment", { userId, year, membershipType });
  try {
    await setDoc(ref, {
      userId,
      year,
      createdAt: serverTimestamp(),
      paidAt: isConfirmed ? serverTimestamp() : null,
      amount: amount ?? null,
      method: method ?? null,
      membershipType,
      recordedBy: auth.currentUser?.uid ?? null,
      status,
      purpose: resolvedPurpose,
      groupId: groupId ?? null,
    });
    // denormalized update on user doc (lastPaidYear only for confirmed dues)
    await setDoc(
      doc(db, "users", userId),
      {
        ...(isConfirmed && isDues ? { lastPaidYear: year } : {}),
        membershipType,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    logFsSuccess("recordMembershipPayment", { userId, year });
  } catch (error) {
    logFsError("recordMembershipPayment", error, { userId, year });
    throw error;
  }
}

/** Fetch all payment docs for a given year and return Set of userIds */
export async function getActiveMemberIdsForYear(
  year: number,
): Promise<Set<string>> {
  const q = query(
    collection(db, "memberPayments"),
    where("year", "==", year),
    where("status", "==", "confirmed"),
  );
  const snap = await getDocs(q);
  const ids = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as MembershipPayment;
    if (data.userId && data.purpose !== "donation") ids.add(data.userId);
  });
  return ids;
}

/** Return all membership payment history for a user (descending by year) */
export async function getMembershipHistory(
  userId: string,
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
  year: number,
): Promise<MembershipPayment | null> {
  const q = query(
    collection(db, "memberPayments"),
    where("userId", "==", userId),
    where("year", "==", year),
    where("purpose", "==", "dues"),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  let latest: MembershipPayment | null = null;
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as MembershipPayment;
    const paidAt = data.paidAt as { toMillis?: () => number } | undefined;
    const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
    const nextTime =
      (paidAt?.toMillis && paidAt.toMillis()) ||
      (createdAt?.toMillis && createdAt.toMillis()) ||
      0;
    const currentTime = latest
      ? ((
          latest.paidAt as { toMillis?: () => number } | undefined
        )?.toMillis?.() ??
        (
          latest.createdAt as { toMillis?: () => number } | undefined
        )?.toMillis?.() ??
        0)
      : -1;
    if (!latest || nextTime >= currentTime) {
      latest = { id: docSnap.id, ...data };
    }
  });
  return latest;
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
  const paymentQuery = query(
    collection(db, "memberPayments"),
    where("userId", "==", userId),
    where("year", "==", year),
    where("purpose", "==", "dues"),
  );
  logFsStart("updateMembershipPayment", { userId, year });
  const existingSnap = await getDocs(paymentQuery);
  let existing = existingSnap.docs[0];
  if (existingSnap.docs.length > 1) {
    existingSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as MembershipPayment;
      const paidAt = data.paidAt as { toMillis?: () => number } | undefined;
      const createdAt = data.createdAt as
        | { toMillis?: () => number }
        | undefined;
      const nextTime =
        (paidAt?.toMillis && paidAt.toMillis()) ||
        (createdAt?.toMillis && createdAt.toMillis()) ||
        0;
      const existingData = existing?.data() as MembershipPayment | undefined;
      const existingPaidAt = existingData?.paidAt as
        | { toMillis?: () => number }
        | undefined;
      const existingCreatedAt = existingData?.createdAt as
        | { toMillis?: () => number }
        | undefined;
      const currentTime =
        (existingPaidAt?.toMillis && existingPaidAt.toMillis()) ||
        (existingCreatedAt?.toMillis && existingCreatedAt.toMillis()) ||
        0;
      if (!existing || nextTime >= currentTime) {
        existing = docSnap;
      }
    });
  }
  if (!existing) {
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
        purpose: "dues",
        status,
        createdAt: serverTimestamp(),
        paidAt: confirmedCreate ? serverTimestamp() : null,
        amount: updates.amount == null ? null : updates.amount,
        method:
          updates.method == null || updates.method === ""
            ? null
            : updates.method,
        recordedBy: auth.currentUser?.uid ?? null,
      };
      const ref = doc(collection(db, "memberPayments"));
      await setDoc(ref, payload);
      // denormalize membershipType always; lastPaidYear only when confirmed
      await setDoc(
        doc(db, "users", userId),
        {
          membershipType: updates.membershipType,
          ...(confirmedCreate ? { lastPaidYear: year } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
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
      "Membership payment record does not exist and no membershipType provided to create",
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
    await setDoc(existing.ref, payload, { merge: true });
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
        { merge: true },
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

export async function requestCheckMembershipPayment(params: {
  user: User;
  request: {
    year: number;
    membershipType: MembershipType;
    donationAmount?: number;
    requestId: string;
  };
}): Promise<{ ok: boolean; groupId: string; reused?: boolean }> {
  const { user, request } = params;

  if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
    throw new Error(
      "User must be authenticated with a valid UID to request check payment.",
    );
  }

  const token = await user.getIdToken();
  const baseUrl = getFirebaseFunctionsBaseUrl();

  const resp = await fetch(`${baseUrl}/request_check_membership_payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Check request failed: ${resp.status} ${text}`.trim());
  }

  return (await resp.json()) as {
    ok: boolean;
    groupId: string;
    reused?: boolean;
  };
}

function readErrorFromResponse(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const error = record.error;
  return typeof error === "string" && error.trim() ? error : null;
}

export async function reconcilePayPalMembershipOrders(params: {
  user: User;
}): Promise<PayPalReconcileResponse> {
  const { user } = params;
  if (!user || typeof user.uid !== "string" || user.uid.trim() === "") {
    throw new Error("User must be authenticated to reconcile PayPal orders.");
  }

  const token = await user.getIdToken();
  const baseUrl = getFirebaseFunctionsBaseUrl();

  const resp = await fetch(`${baseUrl}/reconcile_paypal_membership_orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  const json = (await resp.json().catch(() => null)) as unknown;
  if (!resp.ok) {
    const message =
      readErrorFromResponse(json) || `Reconciliation failed: ${resp.status}`;
    throw new Error(message);
  }

  return json as PayPalReconcileResponse;
}

export async function confirmMembershipPaymentGroup(params: {
  groupId?: string;
  paymentId?: string;
}): Promise<{ updated: number }> {
  const { groupId, paymentId } = params;
  if (!groupId && !paymentId) {
    throw new Error("groupId or paymentId is required");
  }

  const paymentsCol = collection(db, "memberPayments");
  let snap;

  if (groupId) {
    snap = await getDocs(query(paymentsCol, where("groupId", "==", groupId)));
  } else {
    const docSnap = await getDoc(doc(db, "memberPayments", paymentId!));
    if (!docSnap.exists()) throw new Error("Payment record not found");
    snap = { docs: [docSnap] } as { docs: (typeof docSnap)[] };
  }

  if (snap.docs.length === 0) {
    throw new Error("Payment record not found");
  }

  const batch = writeBatch(db);
  let duesUserId: string | null = null;
  let duesYear: number | null = null;
  let duesMembershipType: MembershipType | null = null;
  let updatedCount = 0;

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as MembershipPayment;
    if (data.status !== "confirmed") {
      batch.set(
        docSnap.ref,
        { status: "confirmed", paidAt: serverTimestamp() },
        { merge: true },
      );
      updatedCount += 1;
    }
    const purpose = data.purpose ?? "dues";
    if (purpose === "dues" && data.membershipType) {
      duesUserId = data.userId;
      duesYear = data.year;
      duesMembershipType = data.membershipType;
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
  }

  if (duesUserId && duesYear !== null && duesMembershipType !== null) {
    await setDoc(
      doc(db, "users", duesUserId),
      {
        lastPaidYear: duesYear,
        membershipType: duesMembershipType,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return { updated: updatedCount };
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
  onError?: (error: unknown) => void,
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
    },
  );
}

/**
 * Update membership settings (admin only)
 * @throws Error if user is not authenticated
 */
export async function updateMembershipSettings(
  settings: Partial<Omit<MembershipSettings, "updatedAt" | "updatedBy">>,
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
      { merge: true },
    );
    logFsSuccess("updateMembershipSettings");
  } catch (e) {
    logFsError("updateMembershipSettings", e);
    throw e;
  }
}
