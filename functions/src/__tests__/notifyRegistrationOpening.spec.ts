import { describe, expect, it } from "vitest";

import {
  buildRegistrationOpeningNotificationId,
  shouldSendRegistrationOpeningNotification,
} from "../notifyRegistrationOpening";

describe("shouldSendRegistrationOpeningNotification", () => {
  const now = new Date("2026-06-18T12:00:00.000Z");

  it("returns true when the registration window has opened and notifications are enabled", () => {
    expect(
      shouldSendRegistrationOpeningNotification(
        {
          registrationStart: new Date("2026-06-18T11:00:00.000Z"),
          registrationOpeningNotificationEnabled: true,
          status: "Upcoming",
        },
        now,
      ),
    ).toBe(true);
  });

  it("returns false when the tournament disabled registration-opening pushes", () => {
    expect(
      shouldSendRegistrationOpeningNotification(
        {
          registrationStart: new Date("2026-06-18T11:00:00.000Z"),
          registrationOpeningNotificationEnabled: false,
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns false after a notification has already been marked sent", () => {
    expect(
      shouldSendRegistrationOpeningNotification(
        {
          registrationStart: new Date("2026-06-18T11:00:00.000Z"),
          registrationOpeningNotificationSentAt: new Date(
            "2026-06-18T11:05:00.000Z",
          ),
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns false before registration starts", () => {
    expect(
      shouldSendRegistrationOpeningNotification(
        {
          registrationStart: new Date("2026-06-18T13:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns false after registration has already ended", () => {
    expect(
      shouldSendRegistrationOpeningNotification(
        {
          registrationStart: new Date("2026-06-18T10:00:00.000Z"),
          registrationEnd: new Date("2026-06-18T11:30:00.000Z"),
          status: "Upcoming",
        },
        now,
      ),
    ).toBe(false);
  });

  it("returns false for canceled tournaments", () => {
    expect(
      shouldSendRegistrationOpeningNotification(
        {
          registrationStart: new Date("2026-06-18T11:00:00.000Z"),
          status: "Canceled",
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("buildRegistrationOpeningNotificationId", () => {
  it("builds a stable idempotent notification document id", () => {
    expect(
      buildRegistrationOpeningNotificationId("tournament-1", "user-1"),
    ).toBe("registration_opening_tournament-1_user-1");
  });
});
