import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fires a GA4 page_view on every route change via window.gtag.
 * Relies on Firebase Analytics having initialized gtag (consent-gated).
 * Call once at the App root so all navigations are captured.
 */
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (!window.gtag) return;

    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);
};
