export type PendingSignupProfile = {
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
};

const STORAGE_KEY = "pendingSignupProfile";

function isPendingSignupProfile(value: unknown): value is PendingSignupProfile {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.email === "string" &&
    typeof record.firstName === "string" &&
    typeof record.lastName === "string" &&
    typeof record.createdAt === "number"
  );
}

function parsePendingSignupProfile(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isPendingSignupProfile(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function storePendingSignupProfile(profile: PendingSignupProfile) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors (private mode, quota exceeded, etc.)
  }
}

export function consumePendingSignupProfile(email: string) {
  const stored = parsePendingSignupProfile(
    window.localStorage.getItem(STORAGE_KEY),
  );
  if (!stored) return null;
  if (stored.email.toLowerCase() !== email.toLowerCase()) {
    return null;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return stored;
}

export function clearPendingSignupProfile() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
