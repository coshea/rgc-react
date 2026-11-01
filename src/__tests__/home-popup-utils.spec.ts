import { beforeEach, describe, expect, it } from "vitest";

import {
  HOME_POPUP_AUDIENCE,
  HOME_POPUP_STATUS,
  type HomePopup,
} from "@/types/homePopup";
import {
  HOME_POPUP_STATE,
  HOME_POPUP_TEMPLATES,
  addDaysYmd,
  findPlaceholders,
  formFromPopup,
  formFromTemplate,
  formToInput,
  homePopupState,
  isDismissed,
  isValidCtaLink,
  pickLivePopup,
  readLocalDismissals,
  rememberLocalDismissal,
  todayUtc,
  validateHomePopupForm,
  ymdToUtcDate,
  type HomePopupForm,
} from "@/utils/homePopup";

const today = ymdToUtcDate("2026-11-15");

function popup(overrides: Partial<HomePopup> = {}): HomePopup {
  return {
    id: "p1",
    title: "Title",
    body: "Body",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
    status: HOME_POPUP_STATUS.PUBLISHED,
    startDate: ymdToUtcDate("2026-11-01"),
    version: 1,
    ...overrides,
  };
}

function form(overrides: Partial<HomePopupForm> = {}): HomePopupForm {
  return {
    title: "2027 memberships are open",
    body: "Renew now.",
    ctaLabel: "Renew membership",
    ctaLink: "/membership",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
    startYmd: "2026-11-01",
    endYmd: "",
    templateId: "membership-open",
    ...overrides,
  };
}

describe("findPlaceholders", () => {
  it("finds uppercase placeholders but not markdown links", () => {
    expect(findPlaceholders("[YEAR] memberships, see [the page](/membership)")).toEqual([
      "[YEAR]",
    ]);
    expect(findPlaceholders("[EVENT NAME] on [DATE]")).toEqual(["[EVENT NAME]", "[DATE]"]);
    expect(findPlaceholders("No placeholders")).toEqual([]);
  });
});

describe("isValidCtaLink", () => {
  it("accepts site paths and https URLs only", () => {
    expect(isValidCtaLink("/membership")).toBe(true);
    expect(isValidCtaLink("https://example.com")).toBe(true);
    expect(isValidCtaLink("//evil.example")).toBe(false);
    expect(isValidCtaLink("javascript:alert(1)")).toBe(false);
    expect(isValidCtaLink("http://example.com")).toBe(false);
  });
});

describe("validateHomePopupForm", () => {
  it("lets a draft keep placeholders and an empty title", () => {
    expect(
      validateHomePopupForm(form({ title: "", body: "[DATE]" }), { publishing: false }),
    ).toEqual({});
  });

  it("blocks publishing with placeholders left", () => {
    const errors = validateHomePopupForm(
      form({ title: "[YEAR] memberships are open", ctaLink: "/wrapped/[YEAR]" }),
      { publishing: true },
    );
    expect(errors.title).toMatch(/\[YEAR\]/);
    expect(errors.ctaLink).toMatch(/\[YEAR\]/);
  });

  it("needs both button fields or neither", () => {
    expect(
      validateHomePopupForm(form({ ctaLink: "" }), { publishing: true }).ctaLink,
    ).toBeTruthy();
    expect(
      validateHomePopupForm(form({ ctaLabel: "" }), { publishing: true }).ctaLabel,
    ).toBeTruthy();
    expect(
      validateHomePopupForm(form({ ctaLabel: "", ctaLink: "" }), { publishing: true }),
    ).toEqual({});
  });

  it("rejects an end date before the start, even for drafts", () => {
    expect(
      validateHomePopupForm(form({ endYmd: "2026-10-01" }), { publishing: false }).endYmd,
    ).toBeTruthy();
  });
});

describe("homePopupState", () => {
  it("tracks draft, scheduled, live and ended", () => {
    expect(homePopupState(popup({ status: HOME_POPUP_STATUS.DRAFT }), today)).toBe(
      HOME_POPUP_STATE.DRAFT,
    );
    expect(
      homePopupState(popup({ startDate: ymdToUtcDate("2026-12-01") }), today),
    ).toBe(HOME_POPUP_STATE.SCHEDULED);
    expect(homePopupState(popup(), today)).toBe(HOME_POPUP_STATE.LIVE);
    expect(
      homePopupState(popup({ endDate: ymdToUtcDate("2026-11-15") }), today),
    ).toBe(HOME_POPUP_STATE.LIVE);
    expect(
      homePopupState(popup({ endDate: ymdToUtcDate("2026-11-14") }), today),
    ).toBe(HOME_POPUP_STATE.ENDED);
  });
});

describe("pickLivePopup", () => {
  it("hides members-only popups from visitors and picks the latest published", () => {
    const older = popup({ id: "old", publishedAt: new Date("2026-11-01T10:00:00Z") });
    const members = popup({
      id: "members",
      audience: HOME_POPUP_AUDIENCE.MEMBERS,
      publishedAt: new Date("2026-11-10T10:00:00Z"),
    });
    expect(pickLivePopup([older, members], false, today)?.id).toBe("old");
    expect(pickLivePopup([older, members], true, today)?.id).toBe("members");
    expect(
      pickLivePopup([popup({ status: HOME_POPUP_STATUS.DRAFT })], true, today),
    ).toBeNull();
  });

  it("shows visitors-only popups to signed-out people only", () => {
    const welcome = popup({ id: "welcome", audience: HOME_POPUP_AUDIENCE.VISITORS });
    expect(pickLivePopup([welcome], false, today)?.id).toBe("welcome");
    expect(pickLivePopup([welcome], true, today)).toBeNull();
  });
});

describe("dismissals", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the dismissed version on this device", () => {
    rememberLocalDismissal("p1", 1);
    const local = readLocalDismissals();
    expect(isDismissed(popup(), local)).toBe(true);
    // "Show again" bumps the version, so it shows again.
    expect(isDismissed(popup({ version: 2 }), local)).toBe(false);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("rgc.homePopupDismissals", "not json");
    expect(readLocalDismissals()).toEqual({});
  });
});

describe("forms and templates", () => {
  it("round-trips dates as midnight UTC", () => {
    const input = formToInput(form({ endYmd: "2027-03-31" }), HOME_POPUP_STATUS.DRAFT);
    expect(input.startDate.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(input.endDate?.toISOString()).toBe("2027-03-31T00:00:00.000Z");
    const back = formFromPopup(popup({ startDate: input.startDate, endDate: input.endDate }));
    expect(back.startYmd).toBe("2026-11-01");
    expect(back.endYmd).toBe("2027-03-31");
  });

  it("starts a template today and ends it 30 days later", () => {
    const f = formFromTemplate(HOME_POPUP_TEMPLATES[0], ymdToUtcDate("2026-11-15"));
    expect(f.startYmd).toBe("2026-11-15");
    expect(f.endYmd).toBe("2026-12-15");
    expect(f.templateId).toBe(HOME_POPUP_TEMPLATES[0].id);
  });

  it("adds days across month and year ends", () => {
    expect(addDaysYmd("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDaysYmd("2028-02-15", 30)).toBe("2028-03-16");
  });

  it("uses today's local date", () => {
    expect(todayUtc(new Date(2026, 10, 15, 23, 30)).toISOString()).toBe(
      "2026-11-15T00:00:00.000Z",
    );
  });

  it("has valid template links and no tournament templates", () => {
    for (const t of HOME_POPUP_TEMPLATES) {
      expect(t.name.toLowerCase()).not.toContain("tournament");
      if (t.ctaLink) expect(t.ctaLink.startsWith("/")).toBe(true);
    }
  });
});
