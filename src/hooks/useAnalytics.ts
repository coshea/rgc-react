import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { queuePageView } from "@/utils/analytics";

/**
 * Queues a GA4 page_view on every route change. The queue in
 * `@/utils/analytics` sends it once analytics is enabled (consent-gated) and
 * the new page has set its title. Call once at the App root.
 */
export const useAnalytics = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    queuePageView(pathname, search);
  }, [pathname, search]);
};
