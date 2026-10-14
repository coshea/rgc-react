// Lightweight logger shim that prefers `firebase-functions/logger` when
// available at runtime, but falls back to console methods for tests and
// local dev where the module may not be present or behave differently.
import { captureLoggedError } from "./sentry";

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

// Errors are also reported to Sentry. Handlers wrapped in withSentry() flush
// them before the invocation ends.
export const logger: typeof fallback = {
  info: (...args) => base.info(...args),
  warn: (...args) => base.warn(...args),
  debug: (...args) => base.debug(...args),
  error: (message?: unknown, ...detail: unknown[]) => {
    base.error(message, ...detail);
    captureLoggedError(String(message), detail);
  },
};

export default logger;
