import { logger } from "@/config/sentry";

/**
 * iOS Safari sometimes kills IndexedDB transactions while a tab is in the
 * background (e.g. a member leaves to tap a sign-in link in Mail and comes
 * back). Firestore's offline cache then fails an internal assertion, and the
 * client stays broken until the page reloads: queries never resolve and pages
 * like /wrapped sit on a spinner. Reloading reopens IndexedDB and works.
 */
const FIRESTORE_CACHE_FAILURE_PATTERNS: readonly RegExp[] = [
  // Any internal assertion leaves Firestore's async queue permanently failed.
  /FIRESTORE \([^)]*\) INTERNAL ASSERTION FAILED/i,
  /without an in-progress transaction/i,
  /IndexedDB transaction '[^']+' failed/i,
  /Database deleted by request of the user/i,
];

export const FIRESTORE_RECOVERY_GUARD_KEY = "rgc:firestore-cache-reload-at";

/** Don't reload again within this window, so a cache that stays broken can't loop. */
export const FIRESTORE_RECOVERY_COOLDOWN_MS = 10 * 60 * 1000;

export function isFirestoreCacheFailure(message: string): boolean {
  return FIRESTORE_CACHE_FAILURE_PATTERNS.some((pattern) =>
    pattern.test(message),
  );
}

function messageOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const { message } = value as { message?: unknown };
    if (typeof message === "string") return message;
  }
  return "";
}

/**
 * Reloads the page once per cooldown window. Returns whether it reloaded.
 * Without sessionStorage there is no loop guard, so it never reloads.
 */
export function reloadForFirestoreCacheFailure(
  message: string,
  now = Date.now(),
  reload: () => void = () => window.location.reload(),
): boolean {
  try {
    const last = Number(
      window.sessionStorage.getItem(FIRESTORE_RECOVERY_GUARD_KEY),
    );
    if (Number.isFinite(last) && now - last < FIRESTORE_RECOVERY_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(FIRESTORE_RECOVERY_GUARD_KEY, String(now));
  } catch {
    return false;
  }

  logger.warn(
    logger.fmt`Reloading after Firestore offline cache failure: ${message.slice(0, 200)}`,
  );
  reload();
  return true;
}

export function installFirestoreCacheRecovery(): void {
  if (typeof window === "undefined") return;

  const handle = (value: unknown, fallback = "") => {
    const message = messageOf(value) || fallback;
    if (isFirestoreCacheFailure(message)) {
      reloadForFirestoreCacheFailure(message);
    }
  };

  window.addEventListener("error", (event) =>
    handle(event.error, event.message),
  );
  window.addEventListener("unhandledrejection", (event) =>
    handle(event.reason),
  );
}
