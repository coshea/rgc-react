import { describe, expect, it } from "vitest";

import {
  buildRegistrationOpeningNotificationId,
  getAdminEmails,
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

describe("getAdminEmails", () => {
  it("reads emails from admin docs and removes duplicates", async () => {
    const userDocs = new Map<string, { email?: string }>([
      ["admin-1", { email: "admin1@example.com" }],
      ["admin-2", { email: "admin1@example.com" }],
      ["admin-3", { email: "admin3@example.com" }],
    ]);

    const db = {
      collection: (name: string) => {
        if (name !== "admin") {
          throw new Error(`Unexpected collection ${name}`);
        }

        return {
          get: async () => ({
            docs: [
              { id: "admin-1", data: () => ({ isAdmin: true }) },
              { id: "admin-2", data: () => ({ admin: "true" }) },
              { id: "admin-3", data: () => ({ admin: true }) },
              { id: "admin-4", data: () => ({ isAdmin: false }) },
            ],
          }),
        };
      },
      doc: (path: string) => {
        const uid = path.replace("users/", "");
        return {
          get: async () => ({
            data: () => userDocs.get(uid),
          }),
        };
      },
    };

    await expect(
      getAdminEmails(db as unknown as Parameters<typeof getAdminEmails>[0]),
    ).resolves.toEqual(["admin1@example.com", "admin3@example.com"]);
  });
});
