import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logEvent = vi.fn();
let instance: object | undefined;

vi.mock("firebase/analytics", () => ({
  logEvent: (...args: unknown[]) => logEvent(...args),
}));

vi.mock("@/config/firebase", () => ({
  getAnalyticsInstance: () => instance,
}));

import {
  AnalyticsEvent,
  PAGE_TITLE_TIMEOUT_MS,
  PurchaseItem,
  flushPageView,
  notifyPageTitleSet,
  queuePageView,
  resetPageViewQueueForTests,
  trackEvent,
  trackPurchase,
} from "@/utils/analytics";

function navigate(path: string) {
  window.history.pushState({}, "", path);
}

describe("analytics page-view queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logEvent.mockClear();
    resetPageViewQueueForTests();
    instance = {};
    document.title = "Previous Page";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the new page's title before sending", () => {
    navigate("/tournaments");
    queuePageView("/tournaments", "");
    expect(logEvent).not.toHaveBeenCalled();

    document.title = "Tournaments | RGC";
    notifyPageTitleSet();

    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(instance, "page_view", {
      page_path: "/tournaments",
      page_location: window.location.href,
      page_title: "Tournaments | RGC",
    });
  });

  it("sends immediately when the title was set before the route change was queued", () => {
    navigate("/about");
    document.title = "About | RGC";
    notifyPageTitleSet();
    queuePageView("/about", "?tab=1");

    expect(logEvent).toHaveBeenCalledWith(
      instance,
      "page_view",
      expect.objectContaining({
        page_path: "/about?tab=1",
        page_title: "About | RGC",
      }),
    );
  });

  it("falls back to sending after a timeout when no title is reported", () => {
    navigate("/admin/notifications");
    queuePageView("/admin/notifications", "");
    expect(logEvent).not.toHaveBeenCalled();

    vi.advanceTimersByTime(PAGE_TITLE_TIMEOUT_MS);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("holds the landing page view until analytics is enabled", () => {
    instance = undefined;
    navigate("/");
    queuePageView("/", "");
    document.title = "Home | RGC";
    notifyPageTitleSet();
    expect(logEvent).not.toHaveBeenCalled();

    // Consent granted / initialization finished.
    instance = {};
    flushPageView();
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      instance,
      "page_view",
      expect.objectContaining({ page_path: "/", page_title: "Home | RGC" }),
    );

    // Flushing again does not double-send.
    flushPageView();
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("only reports the latest route when navigating before the title arrives", () => {
    navigate("/a");
    queuePageView("/a", "");
    navigate("/b");
    queuePageView("/b", "");
    notifyPageTitleSet();

    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      instance,
      "page_view",
      expect.objectContaining({ page_path: "/b" }),
    );
    vi.advanceTimersByTime(PAGE_TITLE_TIMEOUT_MS);
    expect(logEvent).toHaveBeenCalledTimes(1);
  });
});

describe("analytics events", () => {
  beforeEach(() => {
    logEvent.mockClear();
    instance = {};
  });

  it("does nothing without consent", () => {
    instance = undefined;
    trackEvent(AnalyticsEvent.TOURNAMENT_REGISTER, { team_size: 2 });
    trackPurchase({
      transactionId: "ORDER1",
      value: 100,
      currency: "USD",
      item: PurchaseItem.FULL_MEMBERSHIP,
    });
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("logs custom events with params", () => {
    trackEvent(AnalyticsEvent.TOURNAMENT_REGISTER, {
      tournament_id: "t1",
      team_size: 2,
    });
    expect(logEvent).toHaveBeenCalledWith(instance, "tournament_register", {
      tournament_id: "t1",
      team_size: 2,
    });
  });

  it("logs a GA4 purchase with a single item", () => {
    trackPurchase({
      transactionId: "ORDER1",
      value: 25,
      currency: "USD",
      item: PurchaseItem.DONATION,
    });
    expect(logEvent).toHaveBeenCalledWith(instance, "purchase", {
      transaction_id: "ORDER1",
      value: 25,
      currency: "USD",
      items: [
        {
          item_id: "donation",
          item_name: "donation",
          price: 25,
          quantity: 1,
        },
      ],
    });
  });
});
