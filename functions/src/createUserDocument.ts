import type { UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { withSentry } from "./sentry";

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

const ALREADY_EXISTS_CODE = 6;

// Uses create() so a document the client already wrote (or an admin created) is
// never overwritten. Deleting the user doc on account removal is intentionally
// NOT done: we keep user records for record keeping.
export const createUserDocument = functions.auth.user().onCreate(
  withSentry("createUserDocument", async (user: UserRecord) => {
    const payload = buildUserDocumentData({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });

    if (!payload) {
      return null;
    }

    try {
      await getFirestore().collection("users").doc(user.uid).create(payload);
    } catch (error) {
      if ((error as { code?: number | string })?.code === ALREADY_EXISTS_CODE) {
        return null;
      }
      throw error;
    }
    return null;
  }),
);
