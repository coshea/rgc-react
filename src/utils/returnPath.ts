/**
 * Remembers where a signed-out member was headed (e.g. a /wrapped link from an
 * email) so login can send them back. Router `state` alone is lost when the
 * magic link opens a fresh page or Google sign-in falls back to a redirect.
 */
const RETURN_PATH_KEY = "rgc:returnPath";
/** Ignore a saved path after this long, so a stale one doesn't hijack a later login. */
const RETURN_PATH_TTL_MS = 60 * 60 * 1000;

/** Only same-site paths: "/x" but not "//evil.com" or "/\\evil.com". */
function isSafePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  );
}

export function rememberReturnPath(path: string | undefined): void {
  if (!isSafePath(path)) return;
  try {
    window.localStorage.setItem(
      RETURN_PATH_KEY,
      JSON.stringify({ path, at: Date.now() }),
    );
  } catch {
    // Storage blocked (private mode); router state still covers same-page logins.
  }
}

/** The saved path (if fresh and safe), cleared once read. */
export function consumeReturnPath(): string | null {
  try {
    const raw = window.localStorage.getItem(RETURN_PATH_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(RETURN_PATH_KEY);
    const saved = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof saved.at !== "number" || Date.now() - saved.at > RETURN_PATH_TTL_MS) {
      return null;
    }
    return isSafePath(saved.path) ? saved.path : null;
  } catch {
    return null;
  }
}

/** Where to go after login: router state first, then the saved path. Clears the saved one. */
export function takeReturnPath(from: string | undefined): string | null {
  const saved = consumeReturnPath();
  return isSafePath(from) ? from : saved;
}
