import { describe, expect, it } from "vitest";

import {
  PUSH_TTL_SECONDS,
  buildDeclarativePushPayload,
  buildPushNotificationMessage,
  isStaleSubscriptionStatus,
  isStaleTokenErrorCode,
  toAbsoluteUrl,
  toPushTopic,
} from "../sendPushNotification";

const notification = {
  uid: "user-1",
  title: "Tournament update",
  body: "Registration opens now.",
  data: {
    link: "/tournaments/abc",
    tournamentId: "abc",
  },
};

describe("buildDeclarativePushPayload", () => {
  it("builds a declarative web push payload with an absolute navigate URL", () => {
    const payload = buildDeclarativePushPayload(
      "notification-123",
      notification,
      3,
    );

    expect(payload).toEqual({
      web_push: 8030,
      notification: {
        title: "Tournament update",
        body: "Registration opens now.",
        lang: "en-US",
        dir: "ltr",
        navigate: "https://ridgefieldgolfclub.org/tournaments/abc",
        tag: "notification-123",
        silent: false,
        app_badge: "3",
        data: {
          notificationId: "notification-123",
          link: "https://ridgefieldgolfclub.org/tournaments/abc",
          tournamentId: "abc",
        },
      },
    });
  });

  it("omits app_badge when there are no unread notifications", () => {
    const payload = buildDeclarativePushPayload("n-1", notification, 0);
    expect(payload.notification).not.toHaveProperty("app_badge");
  });

  it("falls back to the site root when there is no link", () => {
    const payload = buildDeclarativePushPayload(
      "n-1",
      { uid: "u", title: "Hello", body: "World" },
      0,
    );
    expect(payload.notification.navigate).toBe(
      "https://ridgefieldgolfclub.org/",
    );
  });
});

describe("buildPushNotificationMessage (legacy FCM)", () => {
  it("builds a data-only payload with TTL and no APNs block", () => {
    const message = buildPushNotificationMessage(
      "notification-123",
      ["token-1"],
      notification,
      2,
    );

    expect(message.notification).toBeUndefined();
    expect(message.webpush?.notification).toBeUndefined();
    expect(message.apns).toBeUndefined();
    expect(message.data).toEqual({
      notificationId: "notification-123",
      title: "Tournament update",
      body: "Registration opens now.",
      badge: "2",
      link: "/tournaments/abc",
      tournamentId: "abc",
    });
    expect(message.webpush?.headers).toEqual({
      Urgency: "high",
      TTL: String(PUSH_TTL_SECONDS),
    });
    expect(message.webpush?.fcmOptions?.link).toBe("/tournaments/abc");
  });
});

describe("helpers", () => {
  it("treats invalid and unregistered FCM tokens as stale", () => {
    expect(
      isStaleTokenErrorCode("messaging/registration-token-not-registered"),
    ).toBe(true);
    expect(isStaleTokenErrorCode("messaging/invalid-registration-token")).toBe(
      true,
    );
    expect(isStaleTokenErrorCode("messaging/internal-error")).toBe(false);
    expect(isStaleTokenErrorCode(undefined)).toBe(false);
  });

  it("treats 404 and 410 web push responses as stale subscriptions", () => {
    expect(isStaleSubscriptionStatus(404)).toBe(true);
    expect(isStaleSubscriptionStatus(410)).toBe(true);
    expect(isStaleSubscriptionStatus(429)).toBe(false);
    expect(isStaleSubscriptionStatus(500)).toBe(false);
    expect(isStaleSubscriptionStatus(undefined)).toBe(false);
  });

  it("resolves relative and absolute links against the site origin", () => {
    expect(toAbsoluteUrl("/tournaments/x")).toBe(
      "https://ridgefieldgolfclub.org/tournaments/x",
    );
    expect(toAbsoluteUrl("https://ridgefieldgolfclub.org/blog")).toBe(
      "https://ridgefieldgolfclub.org/blog",
    );
    expect(toAbsoluteUrl(undefined)).toBe("https://ridgefieldgolfclub.org/");
  });

  it("only uses notification IDs that are valid Topic header values", () => {
    expect(toPushTopic("AbC123_-xyz")).toBe("AbC123_-xyz");
    expect(toPushTopic("has spaces")).toBeUndefined();
    expect(toPushTopic("x".repeat(33))).toBeUndefined();
  });
});
