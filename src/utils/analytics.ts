import { logEvent } from "firebase/analytics";
import * as Sentry from "@sentry/react";

import { getAnalyticsInstance } from "@/config/firebase";

/**
 * Custom GA4 event names. Define new ones here and reuse them; GA4
 * recommended events (e.g. `purchase`) have their own typed helpers below.
 */
export const AnalyticsEvent = {
  // New registrations only (the GA4 key event); edits are tracked separately.
  TOURNAMENT_REGISTER: "tournament_register",
  TOURNAMENT_REGISTRATION_UPDATE: "tournament_registration_update",
  TOURNAMENT_WITHDRAW: "tournament_withdraw",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export type AnalyticsParams = Record<string, string | number | boolean>;

/** Item names used on GA4 `purchase` events. */
export const PurchaseItem = {
  FULL_MEMBERSHIP: "full_membership",
  HANDICAP_MEMBERSHIP: "handicap_membership",
  DONATION: "donation",
} as const;

export type PurchaseItemName = (typeof PurchaseItem)[keyof typeof PurchaseItem];

/** How long to wait for the new page to set its title before sending anyway. */
export const PAGE_TITLE_TIMEOUT_MS = 1500;

/** Logs a custom event. No-op until the user has consented to analytics. */
export function trackEvent(name: AnalyticsEventName, params?: AnalyticsParams) {
  const instance = getAnalyticsInstance();
  if (!instance) return;
  try {
    logEvent(instance, name, params);
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** Logs a GA4 `purchase` key event for a completed PayPal payment. */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency: string;
  item: PurchaseItemName;
}) {
  const instance = getAnalyticsInstance();
  if (!instance) return;
  try {
    logEvent(instance, "purchase", {
      transaction_id: params.transactionId,
      value: params.value,
      currency: params.currency,
      items: [
        {
          item_id: params.item,
          item_name: params.item,
          price: params.value,
          quantity: 1,
        },
      ],
    });
  } catch (error) {
    Sentry.captureException(error);
  }
}

// ---------------------------------------------------------------------------
// Page views
//
// A page_view is queued on every route change and sent once both:
//   - analytics is enabled (consent may be granted after the page loaded), and
//   - the new page has set document.title (pages are lazy-loaded, so the title
//     is usually still the previous page's when the route changes).
// If the page never reports a title, it is sent after PAGE_TITLE_TIMEOUT_MS.
// ---------------------------------------------------------------------------

type PendingPageView = {
  pathname: string;
  pagePath: string;
  pageLocation: string;
  titleReady: boolean;
};

let pending: PendingPageView | null = null;
let titleTimer: ReturnType<typeof setTimeout> | null = null;
// Pathname of the page that most recently set its title. Child effects can run
// before App's effect when the page chunk is already loaded, so the title may
// arrive before the route change is queued.
let titledPathname: string | null = null;

function clearTitleTimer() {
  if (titleTimer) {
    clearTimeout(titleTimer);
    titleTimer = null;
  }
}

/** Sends the queued page_view if analytics is enabled and the title is set. */
export function flushPageView() {
  if (!pending?.titleReady) return;
  const instance = getAnalyticsInstance();
  if (!instance) return; // stays queued until consent enables analytics

  const { pagePath, pageLocation } = pending;
  pending = null;
  clearTitleTimer();
  try {
    logEvent(instance, "page_view", {
      page_path: pagePath,
      page_location: pageLocation,
      page_title: document.title,
    });
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** Queues a page_view for the current route. Called by useAnalytics. */
export function queuePageView(pathname: string, search: string) {
  clearTitleTimer();
  pending = {
    pathname,
    pagePath: pathname + search,
    pageLocation: window.location.href,
    titleReady: titledPathname === pathname,
  };

  if (pending.titleReady) {
    flushPageView();
    return;
  }

  titleTimer = setTimeout(() => {
    titleTimer = null;
    if (pending) pending.titleReady = true;
    flushPageView();
  }, PAGE_TITLE_TIMEOUT_MS);
}

/** Tells the page-view queue the current page has set document.title. */
export function notifyPageTitleSet() {
  titledPathname = window.location.pathname;
  if (pending && pending.pathname === titledPathname) {
    pending.titleReady = true;
    flushPageView();
  }
}

/** Test-only: resets the page-view queue between tests. */
export function resetPageViewQueueForTests() {
  clearTitleTimer();
  pending = null;
  titledPathname = null;
}
