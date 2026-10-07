import { useEffect } from "react";
import { siteConfig } from "@/config/site";

// page_view events are fired centrally by useAnalytics (App.tsx).
// This hook only manages document.title.
export const usePageTracking = (pageTitle?: string, skip?: boolean) => {
  useEffect(() => {
    if (skip) return;

    const title = pageTitle
      ? `${pageTitle} | ${siteConfig.name}`
      : siteConfig.name;
    document.title = title;
  }, [pageTitle, skip]);
};
