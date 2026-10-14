import { useEffect } from "react";
import { siteConfig } from "@/config/site";
import { notifyPageTitleSet } from "@/utils/analytics";

// page_view events are queued centrally by useAnalytics (App.tsx). This hook
// sets document.title and tells that queue the title is ready to report.
export const usePageTracking = (pageTitle?: string, skip?: boolean) => {
  useEffect(() => {
    if (skip) return;

    const title = pageTitle
      ? `${pageTitle} | ${siteConfig.name}`
      : siteConfig.name;
    document.title = title;
    notifyPageTitleSet();
  }, [pageTitle, skip]);
};
