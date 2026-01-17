import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import * as Sentry from "@sentry/react";

const SENTRY_DSN =
  import.meta.env.VITE_SENTRY_DSN ??
  "https://fc000efe85e0fae20f18bfb05ee0ab21@o4510721156644864.ingest.us.sentry.io/4510721158283264";

const enabled =
  import.meta.env.PROD || import.meta.env.VITE_SENTRY_ENABLE_IN_DEV === "true";

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

if (enabled) {
  const tracesSampleRate = Number(
    import.meta.env.DEV
      ? "1.0"
      : (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.2"),
  );

  const replaysSessionSampleRate = Number(
    import.meta.env.DEV
      ? "1.0"
      : (import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0.1"),
  );

  const replaysOnErrorSampleRate = Number(
    import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? "1.0",
  );

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,

    // Privacy: keep PII off unless explicitly enabled.
    sendDefaultPii: import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII === "true",

    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration(),
    ],

    // Tracing
    tracesSampleRate: Number.isFinite(tracesSampleRate)
      ? tracesSampleRate
      : 0.2,
    tracePropagationTargets:
      parseCsv(import.meta.env.VITE_SENTRY_TRACE_PROPAGATION_TARGETS).length > 0
        ? parseCsv(import.meta.env.VITE_SENTRY_TRACE_PROPAGATION_TARGETS)
        : ["localhost", window.location.hostname],

    // Session Replay
    replaysSessionSampleRate: Number.isFinite(replaysSessionSampleRate)
      ? replaysSessionSampleRate
      : 0.1,
    replaysOnErrorSampleRate: Number.isFinite(replaysOnErrorSampleRate)
      ? replaysOnErrorSampleRate
      : 1.0,

    // Enable logs to be sent to Sentry
    enableLogs: import.meta.env.VITE_SENTRY_ENABLE_LOGS !== "false",
  });
}
