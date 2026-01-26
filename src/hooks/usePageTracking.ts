import { useEffect } from "react";
import { logEvent } from "firebase/analytics";
import { siteConfig } from "@/config/site";

export const usePageTracking = (pageTitle?: string, skip?: boolean) => {
  useEffect(() => {
    if (skip) return;

    const title = pageTitle
      ? `${pageTitle} | ${siteConfig.name}`
      : siteConfig.name;
    document.title = title;

    // Use window.location to avoid requiring react-router hooks in tests/mocks
    const pagePath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";

    // Dynamically import analytics config to tolerate test module mocks that
    // may not provide `getAnalyticsInstance` as a named export.
    (async () => {
      try {
        const firebaseModule: unknown = await import("@/config/firebase");
        if (typeof firebaseModule === "object" && firebaseModule !== null) {
          const maybe = firebaseModule as {
            getAnalyticsInstance?: () => unknown;
          };
          const getAnalyticsInstance = maybe.getAnalyticsInstance;
          if (typeof getAnalyticsInstance === "function") {
            const analytics = getAnalyticsInstance();
            if (analytics) {
              logEvent(
                analytics as Parameters<typeof logEvent>[0],
                "page_view",
                {
                  page_title: title,
                  page_path: pagePath,
                },
              );
            }
          }
        }
      } catch {
        // ignore analytics errors in tests or environments without analytics
      }
    })();
  }, [pageTitle, skip]);
};
