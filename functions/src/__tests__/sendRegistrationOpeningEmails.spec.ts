import { describe, expect, it, vi } from "vitest";

import { sendRegistrationOpeningPreviewEmail } from "../notifyRegistrationOpening";
import {
  buildRegistrationOpeningAdminEmailHtml,
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
      "Registration is now open for <strong>President&#39;s Cup</strong>",
    );
    expect(html).toContain("<strong>Date:</strong> Saturday, June 20, 2026");
    expect(html).toContain(
      "<strong>Registration closes:</strong> Wednesday, June 17, 2026",
    );
    expect(html).toContain("background-color:#e5e7eb;color:#52525b");
    expect(html).toContain("<strong>Tee times:</strong> Assigned");
    expect(html).toContain("View Tournament &amp; Register");
    expect(html).toContain("/tournaments/presidents-cup");
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
              data: () => ({ email: "admin@example.com" }),
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
    expect(payload.subject).toBe("Registration Open: President's Cup");
  });
});
