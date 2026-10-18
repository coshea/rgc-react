import * as Sentry from "@sentry/node";
import {
  HttpsError,
  type FunctionsErrorCode,
} from "firebase-functions/v2/https";

// Sentry for Cloud Functions, reporting to the rgc-functions project. Disabled
// unless SENTRY_DSN is set (the functions deploy workflow writes it to
// functions/.env), and never in the emulator or tests.
const dsn = process.env.SENTRY_DSN;
const enabled =
  !!dsn &&
  process.env.FUNCTIONS_EMULATOR !== "true" &&
  process.env.VITEST === undefined;
// Sentry Logs for logger.info/warn/error. On by default; SENTRY_ENABLE_LOGS=false
// turns them off without a code change.
const logsEnabled = enabled && process.env.SENTRY_ENABLE_LOGS !== "false";

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    release: process.env.SENTRY_RELEASE,
    // Errors only: tracing would add OpenTelemetry overhead to every cold start.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    enableLogs: logsEnabled,
    // Kept so functions events stay distinguishable if projects are ever merged.
    initialScope: { tags: { service: "functions" } },
  });
}

/** Time allowed to send queued events before an invocation ends. */
const FLUSH_TIMEOUT_MS = 2000;

// HttpsError codes that answer a bad or unauthorized request rather than
// signal a bug, so they are returned to the caller but not reported.
const EXPECTED_HTTPS_ERROR_CODES: ReadonlySet<FunctionsErrorCode> = new Set([
  "cancelled",
  "invalid-argument",
  "not-found",
  "already-exists",
  "permission-denied",
  "resource-exhausted",
  "failed-precondition",
  "out-of-range",
  "unauthenticated",
]);

/** True for errors worth an issue; false for expected HttpsErrors. */
export function shouldReportError(err: unknown): boolean {
  return !(
    err instanceof HttpsError && EXPECTED_HTTPS_ERROR_CODES.has(err.code)
  );
}

/**
 * Wraps a Cloud Functions handler so thrown errors are reported with the
 * function name, and queued events (including ones from `logger.error`) are
 * flushed before the invocation returns. Cloud Run throttles CPU once the
 * handler finishes, so anything still queued after that is usually lost.
 */
export function withSentry<A extends unknown[], R>(
  functionName: string,
  handler: (...args: A) => R | Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    if (!enabled) return handler(...args);
    return Sentry.withIsolationScope(async (scope) => {
      scope.setTag("function", functionName);
      try {
        return await handler(...args);
      } catch (err) {
        if (shouldReportError(err)) Sentry.captureException(err);
        throw err;
      } finally {
        await Sentry.flush(FLUSH_TIMEOUT_MS);
      }
    });
  };
}

/**
 * Reports an error that a handler caught and logged rather than threw.
 * Used by `logger.error` so existing error logs reach Sentry.
 */
export function captureLoggedError(message: string, detail: unknown[]): void {
  if (!enabled) return;
  const error = detail.find((d): d is Error => d instanceof Error);
  const extra = { detail: detail.filter((d) => d !== error) };
  if (error) {
    Sentry.captureException(error, { extra: { message, ...extra } });
  } else {
    Sentry.captureMessage(message, { level: "error", extra });
  }
}

type LogAttributeValue = string | number | boolean;

/**
 * Turns logger detail args into Sentry log attributes. A plain object's fields
 * become searchable attributes (e.g. `uid`, `orderId`); anything else is kept
 * as a string under `detail`.
 */
export function toLogAttributes(
  detail: unknown[],
): Record<string, LogAttributeValue> {
  const attributes: Record<string, LogAttributeValue> = {};
  const rest: string[] = [];
  for (const item of detail) {
    if (isPlainObject(item)) {
      for (const [key, value] of Object.entries(item)) {
        if (value !== undefined) attributes[key] = toAttributeValue(value);
      }
    } else if (item !== undefined) {
      rest.push(String(toAttributeValue(item)));
    }
  }
  if (rest.length > 0) attributes.detail = rest.join(" ");
  return attributes;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function toAttributeValue(value: unknown): LogAttributeValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Sends a logger call to Sentry Logs. Logs are buffered and sent by the same
 * flush withSentry() runs at the end of each invocation.
 */
export function captureLog(
  level: "info" | "warn" | "error",
  message: string,
  detail: unknown[],
): void {
  if (!logsEnabled) return;
  Sentry.logger[level](message, toLogAttributes(detail));
}
