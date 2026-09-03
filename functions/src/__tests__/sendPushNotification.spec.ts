import { describe, expect, it } from "vitest";

import { buildPushNotificationMessage } from "../sendPushNotification";

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
    expect(message.webpush?.fcmOptions?.link).toBe("/tournaments/abc");
    expect(message.apns?.headers?.["apns-collapse-id"]).toBe(
      "notification-123",
    );
  });
});
