export type FirebaseAuthError = {
  code?: string;
  message?: string;
};

export function extractFirebaseAuthError(
  error: unknown
): FirebaseAuthError | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  const code = typeof candidate.code === "string" ? candidate.code : undefined;
  const message =
    typeof candidate.message === "string" ? candidate.message : undefined;

  if (code || message) {
    return { code, message };
  }

  return null;
}
