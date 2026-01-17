// Lightweight logger shim that prefers `firebase-functions/logger` when
// available at runtime, but falls back to console methods for tests and
// local dev where the module may not be present or behave differently.
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
export const logger: typeof fallback =
  (remote && (remote.logger || remote)) || fallback;

export default logger;
