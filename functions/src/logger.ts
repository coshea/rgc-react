// Lightweight logger shim that prefers `firebase-functions/logger` when
// available at runtime, but falls back to console methods for tests and
// local dev where the module may not be present or behave differently.
import { captureLog, captureLoggedError } from "./sentry";

let remote: any = undefined;
try {
  // Use require so this works in both ESM and CommonJS test runtimes.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  remote = require("firebase-functions/logger");
} catch (e) {
  remote = undefined;
}

const fallback = {
  info: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug
    ? console.debug.bind(console)
    : console.log.bind(console),
};

// The firebase logger package sometimes exports the logger as the default
// export or as a named `logger` property. Support both shapes.
const base: typeof fallback = (remote && (remote.logger || remote)) || fallback;

// info/warn/error also go to Sentry Logs, and errors create a Sentry issue.
// debug stays in Cloud Logging only. Handlers wrapped in withSentry() flush
// both before the invocation ends.
export const logger: typeof fallback = {
  info: (message?: unknown, ...detail: unknown[]) => {
    base.info(message, ...detail);
    captureLog("info", String(message), detail);
  },
  warn: (message?: unknown, ...detail: unknown[]) => {
    base.warn(message, ...detail);
    captureLog("warn", String(message), detail);
  },
  debug: (...args) => base.debug(...args),
  error: (message?: unknown, ...detail: unknown[]) => {
    base.error(message, ...detail);
    captureLog("error", String(message), detail);
    captureLoggedError(String(message), detail);
  },
};

export default logger;
