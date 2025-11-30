// Centralized policy-related Firestore access.
// Policies are admin-editable markdown documents for club rules and policies.

import { db } from "@/config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  FirestoreError,
} from "firebase/firestore";
import { Policy, PolicyType } from "@/types/policy";

const POLICIES_COLLECTION = "policies";

// Helper to convert Firestore timestamp to Date
export function toDate(timestamp: any): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp?.toDate) return timestamp.toDate();
  return undefined;
}

// Map Firestore document to Policy
export function mapPolicyDoc(snap: any): Policy {
  const data = snap.data();
  return {
    id: snap.id,
    type: data.type as PolicyType,
    title: data.title || "",
    content: data.content || "",
    lastUpdatedBy: data.lastUpdatedBy,
    lastUpdatedByName: data.lastUpdatedByName,
    createdAt: toDate(data.createdAt) || new Date(),
    updatedAt: toDate(data.updatedAt) || new Date(),
  };
}

// Get a single policy by type
export async function getPolicyByType(
  type: PolicyType
): Promise<Policy | null> {
  try {
    const docRef = doc(db, POLICIES_COLLECTION, type);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return mapPolicyDoc(docSnap);
  } catch (error) {
    console.error("Error fetching policy:", error);
    throw error;
  }
}

// Real-time listener for a policy
export function onPolicy(
  type: PolicyType,
  next: (policy: Policy | null) => void,
  error?: (error: FirestoreError) => void
) {
  const docRef = doc(db, POLICIES_COLLECTION, type);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        next(mapPolicyDoc(snap));
      } else {
        next(null);
      }
    },
    error
  );
}

// Update or create a policy (admin only)
export async function updatePolicy(
  type: PolicyType,
  data: {
    title: string;
    content: string;
    lastUpdatedBy: string;
    lastUpdatedByName: string;
  }
): Promise<void> {
  try {
    const docRef = doc(db, POLICIES_COLLECTION, type);
    const docSnap = await getDoc(docRef);

    const policyData = {
      type,
      title: data.title,
      content: data.content,
      lastUpdatedBy: data.lastUpdatedBy,
      lastUpdatedByName: data.lastUpdatedByName,
      updatedAt: serverTimestamp(),
      ...(docSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(docRef, policyData);
  } catch (error) {
    console.error("Error updating policy:", error);
    throw error;
  }
}
