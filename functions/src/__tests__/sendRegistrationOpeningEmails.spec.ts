import { describe, expect, it, vi } from "vitest";

import { sendRegistrationOpeningPreviewEmail } from "../notifyRegistrationOpening";
import {
  buildRegistrationOpeningAdminEmailHtml,
  buildRegistrationOpeningMemberEmail,
  sendRegistrationOpeningAdminEmail,
} from "../sendRegistrationOpeningEmails";

describe("buildRegistrationOpeningAdminEmailHtml", () => {
  it("renders member-ready details and tournament link", () => {
    const html = buildRegistrationOpeningAdminEmailHtml({
      tournamentTitle: "President's Cup",
      tournamentUrl:
        "https://ridgefieldgolfclub.org/tournaments/presidents-cup",
      tournamentDate: "Saturday, June 20, 2026",
      registrationCloses: "Wednesday, June 17, 2026",
      tournamentTee: "White",
      tournamentTeeTimes: "Assigned",
      fieldSize: "32 teams",
    });

    expect(html).toContain("Hello RGC Members");
    expect(html).toContain(
      "Registration is now open for <strong>President&#39;s Cup</strong>, which will be played on Saturday, June 20, 2026.",
    );
    expect(html).toMatch(/>Registration closes<\/td><td [^>]+>Wednesday, June 17, 2026</);
    expect(html).toContain("background-color:#e5e7eb;color:#52525b");
    expect(html).toMatch(/>Tee times<\/td><td [^>]+>Assigned</);
    expect(html).toMatch(/>Field size<\/td><td [^>]+>32 teams</);
    expect(html).toContain("View Details &amp; Register");
    expect(html).toContain("See you on the course,");
    expect(html).toContain(
      ">https://ridgefieldgolfclub.org/tournaments/presidents-cup</a>",
    );
  });

  it("omits rows and the date clause when details are missing", () => {
    const html = buildRegistrationOpeningAdminEmailHtml({
      tournamentTitle: "Spring Scramble",
      tournamentUrl: "https://ridgefieldgolfclub.org/tournaments/s",
      tournamentTee: "Blue",
      tournamentTeeTimes: "Get your own",
    });

    expect(html).toContain(
      "Registration is now open for <strong>Spring Scramble</strong>. We hope",
    );
    expect(html).not.toContain(">Date<");
    expect(html).not.toContain(">Field size<");
  });

  it("sends the preview to the requesting admin instead of all admins", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const db = {
      doc: vi.fn((path: string) => ({
        get: vi.fn(async () => {
          if (path === "users/admin-123") {
            return {
              exists: true,
              data: () => ({ email: "admin@example.com", firstName: "Chris" }),
            };
          }
          return { exists: false, data: () => undefined };
        }),
      })),
    } as unknown as Parameters<
      typeof sendRegistrationOpeningPreviewEmail
    >[0]["db"];

    await sendRegistrationOpeningPreviewEmail({
      db,
      apiKey: "test-key",
      recipientUid: "admin-123",
      tournamentId: "tourn-1",
      tournament: {
        title: "President's Cup",
        date: new Date("2026-06-20T00:00:00Z"),
        registrationEnd: new Date("2026-06-17T00:00:00Z"),
        tee: "White",
        assignedTeeTimes: true,
        maxTeams: 32,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.to).toEqual(["admin@example.com"]);
    expect(payload.subject).toBe("[Test] Registration Now Open: President's Cup");
    // Member version: personal greeting, preferences footer, unsubscribe header.
    expect(payload.html).toContain("Hi Chris,");
    expect(payload.html).toContain("Manage email preferences");
    expect(payload.headers["List-Unsubscribe"]).toContain(
      "/settings/notifications",
    );
    expect(payload.html).toContain("utm_campaign=registration_opening_preview");
    expect(payload.tags).toContainEqual({
      name: "category",
      value: "registration_opening_preview",
    });
  });
});

describe("buildRegistrationOpeningMemberEmail", () => {
  const params = {
    tournamentTitle: "Spring Scramble",
    tournamentUrl: "https://ridgefieldgolfclub.org/tournaments/abc 1",
    tournamentTee: "Blue",
    tournamentTeeTimes: "Assigned",
  };

  it("personalises the shared template and adds a preferences footer", () => {
    const email = buildRegistrationOpeningMemberEmail(
      { email: "pat@example.com", firstName: "Pat" },
      "abc 1",
      params,
    );

    expect(email.to).toEqual(["pat@example.com"]);
    expect(email.subject).toBe("Registration Now Open: Spring Scramble");
    expect(email.html).toContain("Hi Pat,");
    expect(email.text).toContain("Hi Pat,");
    expect(email.text).toContain("Tee: Blue");
    expect(email.text).toContain("Manage email preferences: https://ridgefieldgolfclub.org/settings/notifications");
    expect(email.text).toContain("utm_campaign=registration_opening");
    expect(email.html).not.toContain("Hello RGC Members");
    expect(email.html).toContain("/settings/notifications");
    expect(email.headers?.["List-Unsubscribe"]).toContain(
      "https://ridgefieldgolfclub.org/settings/notifications",
    );
    expect(email.tags).toEqual([
      { name: "category", value: "registration_opening" },
      { name: "tournament_id", value: "abc_1" },
    ]);
  });

  it("tags tournament links with UTM params but shows the clean URL", () => {
    const email = buildRegistrationOpeningMemberEmail(
      { email: "pat@example.com" },
      "abc1",
      { ...params, tournamentUrl: "https://ridgefieldgolfclub.org/tournaments/abc1" },
    );

    const hrefs = [...email.html.matchAll(/href="([^"]+tournaments[^"]*)"/g)].map(
      (m) => m[1].replace(/&amp;/g, "&"),
    );
    expect(hrefs).toHaveLength(2);
    for (const href of hrefs) {
      const url = new URL(href);
      expect(url.pathname).toBe("/tournaments/abc1");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        utm_source: "resend",
        utm_medium: "email",
        utm_campaign: "registration_opening",
        utm_content: "abc1",
      });
    }
    expect(email.html).toContain(
      ">https://ridgefieldgolfclub.org/tournaments/abc1</a>",
    );
  });

  it("falls back to the group greeting without a first name", () => {
    const email = buildRegistrationOpeningMemberEmail(
      { email: "pat@example.com" },
      "abc",
      params,
    );
    expect(email.html).toContain("Hello RGC Members,");
  });
});
