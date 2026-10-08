import type { UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

export type AuthUserDocumentFields = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

export function parseDisplayName(displayName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (displayName ?? "").trim().split(/\s+/u).filter(Boolean);
  const [first, ...rest] = parts;
  return {
    firstName: first ?? "",
    lastName: rest.join(" "),
  };
}

export function buildUserDocumentData(
  user: AuthUserDocumentFields,
): Record<string, unknown> | null {
  if (!user.email || !user.email.trim()) {
    return null;
  }

  const { firstName, lastName } = parseDisplayName(user.displayName);
  const payload: Record<string, unknown> = {
    email: user.email.trim(),
    displayName: user.displayName?.trim() || undefined,
    photoURL: user.photoURL || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    boardMember: false,
    role: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  Object.keys(payload).forEach((key) => {
    const value = payload[key];
    if (
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      delete payload[key];
    }
  });

  return payload;
}

export const createUserDocument = functions.auth.user().onCreate(
  async (user: UserRecord) => {
  const payload = buildUserDocumentData({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  });

  if (!payload) {
    return null;
  }

    const userDoc = getFirestore().collection("users").doc(user.uid);
    return userDoc.set(payload, { merge: true });
  },
);

export const deleteUserDocument = functions.auth.user().onDelete(
  async (user: UserRecord) => {
    const userDoc = getFirestore().collection("users").doc(user.uid);
    return userDoc.delete();
  },
);
