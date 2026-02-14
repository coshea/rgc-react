import "./config/sentry";

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import ScrollToTop from "@/components/scroll-to-top.tsx";
import DefaultLayout from "@/layouts/default";

const queryClient = new QueryClient();

const CHUNK_RELOAD_GUARD_KEY = "rgc:chunk-reload-attempted";

function isChunkLoadFailureMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("not a valid javascript mime type") ||
    normalized.includes("loading chunk")
  );
}

function getErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const maybeError = value as { message?: unknown };
    if (typeof maybeError.message === "string") return maybeError.message;
  }
  return "";
}

function reloadOnceForChunkFailure(): void {
  if (typeof window === "undefined") return;

  const hasReloaded = window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY);
  if (hasReloaded === "true") return;

  window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, "true");
  window.location.reload();
}

function installChunkLoadRecovery(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const message = event.message || getErrorMessage(event.error);
    if (isChunkLoadFailureMessage(message)) {
      reloadOnceForChunkFailure();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = getErrorMessage(event.reason);
    if (isChunkLoadFailureMessage(message)) {
      reloadOnceForChunkFailure();
    }
  });
}

installChunkLoadRecovery();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Provider>
          <DefaultLayout>
            <ScrollToTop />
            <App />
          </DefaultLayout>
        </Provider>
        {(import.meta.env.DEV ||
          import.meta.env.VITE_ENABLE_REACT_QUERY_DEVTOOLS === "true") && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
