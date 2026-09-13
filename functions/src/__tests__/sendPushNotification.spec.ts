import { describe, expect, it } from "vitest";

import {
  buildPushNotificationMessage,
  isStaleTokenErrorCode,
} from "../sendPushNotification";

describe("buildPushNotificationMessage", () => {
  it("builds a data-only web push payload so the service worker renders one notification", () => {
    const message = buildPushNotificationMessage(
      "notification-123",
      ["token-1"],
      {
        uid: "user-1",
        title: "Tournament update",
        body: "Registration opens now.",
        data: {
          link: "/tournaments/abc",
          tournamentId: "abc",
        },
      },
    );

    expect(message.notification).toBeUndefined();
    expect(message.webpush?.notification).toBeUndefined();
    expect(message.data).toEqual({
      notificationId: "notification-123",
      title: "Tournament update",
      body: "Registration opens now.",
      link: "/tournaments/abc",
      tournamentId: "abc",
    });
    expect(message.webpush?.headers?.Urgency).toBe("high");
    expect(message.webpush?.fcmOptions?.link).toBe("/tournaments/abc");
    expect(message.apns?.headers?.["apns-collapse-id"]).toBe(
      "notification-123",
    );
  });

  it("treats invalid and unregistered tokens as stale", () => {
    expect(
      isStaleTokenErrorCode("messaging/registration-token-not-registered"),
    ).toBe(true);
    expect(isStaleTokenErrorCode("messaging/invalid-registration-token")).toBe(
      true,
    );
    expect(isStaleTokenErrorCode("messaging/internal-error")).toBe(false);
    expect(isStaleTokenErrorCode(undefined)).toBe(false);
  });
});
