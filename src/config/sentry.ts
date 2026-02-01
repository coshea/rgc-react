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

// Custom logger to match project guidelines
export const logger = {
  fmt: (strings: TemplateStringsArray, ...values: any[]) => {
    return strings.reduce((acc, str, i) => {
      const val = values[i];
      const formattedVal = typeof val === "object" ? JSON.stringify(val) : val;
      return acc + str + (i < values.length ? formattedVal : "");
    }, "");
  },
  trace: (msg: any, data?: any) => {
    Sentry.addBreadcrumb({
      category: "log",
      level: "debug",
      message: String(msg),
      data,
    });
  },
  debug: (msg: any, data?: any) => {
    Sentry.addBreadcrumb({
      category: "log",
      level: "debug",
      message: String(msg),
      data,
    });
  },
  info: (msg: any, data?: any) => {
    Sentry.captureMessage(String(msg), { level: "info", extra: data });
  },
  warn: (msg: any, data?: any) => {
    Sentry.captureMessage(String(msg), { level: "warning", extra: data });
  },
  error: (msg: any, data?: any) => {
    Sentry.captureMessage(String(msg), { level: "error", extra: data });
  },
  fatal: (msg: any, data?: any) => {
    Sentry.captureMessage(String(msg), { level: "fatal", extra: data });
  },
  // Metrics
  count: (name: string, value: number = 1, data?: Record<string, unknown>) => {
    Sentry.metrics.count(name, value, data ? { attributes: data } : undefined);
  },
  gauge: (name: string, value: number, data?: Record<string, unknown>) => {
    Sentry.metrics.gauge(name, value, data ? { attributes: data } : undefined);
  },
  distribution: (
    name: string,
    value: number,
    data?: Record<string, unknown>,
  ) => {
    Sentry.metrics.distribution(
      name,
      value,
      data ? { attributes: data } : undefined,
    );
  },
};

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function getSentryClient(): unknown {
  const sentry = Sentry as unknown as Record<string, unknown>;

  const getClient = sentry["getClient"];
  if (typeof getClient === "function") {
    return (getClient as () => unknown)();
  }

  // Check getCurrentScope (v7+) or getCurrentHub (legacy)
  for (const methodName of ["getCurrentScope", "getCurrentHub"]) {
    const getMethod = sentry[methodName];
    if (typeof getMethod === "function") {
      const result = (getMethod as () => unknown)();
      if (result && typeof result === "object") {
        const resultRecord = result as Record<string, unknown>;
        const resultGetClient = resultRecord["getClient"];
        if (typeof resultGetClient === "function") {
          return (resultGetClient as () => unknown)();
        }
      }
    }
  }

  return undefined;
}

if (enabled) {
  const isSmokeTest = new URLSearchParams(window.location.search).has(
    "sentryTest",
  );

  const tracesSampleRate = isSmokeTest
    ? 1.0
    : Number(
        import.meta.env.DEV
          ? "1.0"
          : (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.2"),
      );

  const replaysSessionSampleRate = isSmokeTest
    ? 1.0
    : Number(
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
      Sentry.consoleLoggingIntegration({
        levels: ["error", "warn", "log"],
      }),
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

    // Metrics (experimental)
    _experiments: {
      enableMetrics: true,
    },
  });

  // Emit a short runtime status to help verify Sentry is initialized in prod
  try {
    const sentryClient = getSentryClient();
    const hasClient = !!sentryClient;
    const dsnSource = import.meta.env.VITE_SENTRY_DSN ? "env" : "fallback";

    // eslint-disable-next-line no-console
    console.log(
      `[Sentry] initialized: enabled=${enabled}, client=${hasClient ? "present" : "missing"}, environment=${import.meta.env.MODE}, dsn=${dsnSource}`,
    );

    // Optional, opt-in smoke test: add `?sentryTest=1` to the URL.
    if (hasClient && isSmokeTest) {
      const eventId = Sentry.captureMessage("Sentry smoke test", {
        level: "info",
        tags: { smokeTest: "true" },
      });
      // eslint-disable-next-line no-console
      console.log(`[Sentry] smoke test sent: eventId=${eventId}`);

      // Also try an error
      try {
        throw new Error("Sentry test error");
      } catch (e) {
        Sentry.captureException(e);
      }

      // Test Metrics
      Sentry.metrics.count("button_click", 1, {
        attributes: { test: "true" },
      });
      Sentry.metrics.gauge("page_load_time", 150, {
        attributes: { test: "true" },
      });
      Sentry.metrics.distribution("response_time", 200, {
        attributes: { test: "true" },
      });

      // eslint-disable-next-line no-console
      console.log("[Sentry] smoke test metrics sent");
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("[Sentry] initialization check failed:", err);
  }
}
