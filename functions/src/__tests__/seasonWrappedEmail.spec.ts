import { describe, expect, it } from "vitest";

import {
  buildSeasonWrappedEmail,
  headlineStats,
  seasonWrappedUidTag,
  uidFromSeasonWrappedTags,
} from "../seasonWrapped/email";
import { avatarInitials, shareNameFontSize, shareStatFontSize, shareStats } from "../seasonWrapped/shareImage";
import {
  SEASON_TAG_COLORS,
  moneyRankText,
  moneyWonLabel,
  seasonTagColor,
  shareStamp,
  tagStrapSvg,
  type ClubSeasonStats,
  type SeasonWrappedMember,
} from "../seasonWrapped/types";

const club: ClubSeasonStats = {
  tournamentCount: 14,
  playerCount: 186,
  teamsRegistered: 412,
  prizeMoneyPaid: 18400,
  holesInOne: 3,
  podium: [],
  majors: [],
  tribute: {
    heading: "Thank you, Frank.",
    name: "Frank Sergiovanni",
    role: "Superintendent",
    message: "Thanks",
    stat: "25",
    statLabel: "years of service",
    signoff: "Board",
  },
};

const member: SeasonWrappedMember = {
  uid: "uid_1",
  year: 2026,
  firstName: "Mike",
  displayName: "Mike Reynolds",
  version: 2,
  generatedAt: "2026-11-01T00:00:00.000Z",
  played: true,
  events: { played: 9, calendar: 14, months: [] },
  money: { total: 385, rank: 7, rankLabel: "7", rankedMembers: 64, paidEvents: [] },
  closestToPin: { count: 2, holes: [], aces: [] },
  crew: { distinctTeammates: 11, goldTeeEvents: 0 },
  championshipsWon: [],
  majorResults: {},
  share: { events: 9, total: 385, rankLabel: "7", closestToPins: 2, topPartner: "Tom Becker" },
  shareImagePath: "wrapped/2026/uid_1.png",
};

describe("Season Wrapped email", () => {
  it("leads with the member's own numbers", () => {
    expect(headlineStats(member, club)).toEqual([
      { value: "9", label: "events played" },
      { value: "$385", label: "won, 7th on the\u00a0money\u00a0list" },
      { value: "2", label: "closest to pin" },
    ]);
  });

  it("uses club numbers for members who didn't play", () => {
    const paidOnly = { ...member, played: false, events: undefined, money: undefined };
    expect(headlineStats(paidOnly, club).map((s) => s.value)).toEqual(["14", "186", "$18,400"]);
  });

  it("links to the story with UTM tags and tags the member for click tracking", () => {
    const email = buildSeasonWrappedEmail("mike@example.com", member, club);
    expect(email.to).toEqual(["mike@example.com"]);
    expect(email.subject).toBe("Your 2026 RGC year in review");
    expect(email.html).toContain(
      "https://ridgefieldgolfclub.org/wrapped/2026?utm_source=resend&amp;utm_medium=email&amp;utm_campaign=season_wrapped_2026",
    );
    expect(email.text).not.toContain("Frank Sergiovanni");
    expect(email.tags).toEqual([
      { name: "category", value: "season_wrapped" },
      { name: "year", value: "2026" },
      { name: "uid", value: "uid_1" },
    ]);
  });

  it("adds the member's one-click unsubscribe link to the headers and footer", () => {
    const unsubscribeUrl =
      "https://us-central1-p.cloudfunctions.net/email_unsubscribe?u=uid_1&t=announcements&s=sig";
    const email = buildSeasonWrappedEmail("mike@example.com", member, club, unsubscribeUrl);
    expect(email.headers).toEqual({
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(email.html).toContain(`href="${unsubscribeUrl.replace(/&/g, "&amp;")}"`);
    expect(email.text).toContain(`Unsubscribe: ${unsubscribeUrl}`);
  });

  it("encodes uids Resend can't tag and the webhook decodes them back", () => {
    const uid = "legacy:uid.1@x";
    const tag = seasonWrappedUidTag(uid);
    expect(tag.name).toBe("uid_b64");
    expect(tag.value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(uidFromSeasonWrappedTags({ [tag.name]: tag.value })).toBe(uid);
    expect(uidFromSeasonWrappedTags({ uid: "uid_1" })).toBe("uid_1");
  });
});

describe("share image stats", () => {
  it("shows up to four stats", () => {
    expect(shareStats(member).map((s) => s.label)).toEqual([
      "events",
      // The seal already says "Money list #7".
      "won",
      "closest to pins",
      "top partner",
    ]);
  });

  it("shrinks long names and partner names so they fit the bag tag", () => {
    expect(shareNameFontSize("Pat Doe")).toBe(104);
    expect(shareNameFontSize("Mary Christodoulopoulos")).toBeLessThan(104);
    expect(shareNameFontSize("A Supercalifragilisticexpialidocious")).toBe(44);
    expect(shareStatFontSize({ value: "13", label: "events" })).toBe(84);
    expect(shareStatFontSize({ value: "Mike Pisano", label: "top partner", isName: true })).toBe(84);
    expect(shareStatFontSize({ value: "Bartholomew Christodoulou", label: "top partner", isName: true })).toBe(50);
  });

  it("uses the site's avatar initials when there's no photo", () => {
    expect(avatarInitials("David O'Shea")).toBe("DO");
    expect(avatarInitials("Mary Ann Smith")).toBe("MS");
    expect(avatarInitials("Cher")).toBe("CH");
    expect(avatarInitials("  ")).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
  });

  it("falls back to membership for members with nothing to show", () => {
    const quiet = { ...member, share: { events: 0, total: 0, closestToPins: 0 } };
    expect(shareStats(quiet)).toEqual([{ value: "2026", label: "RGC member" }]);
  });
});

describe("share tag seal and color", () => {
  it("gives no seal without a title, ace, final or top-25 finish", () => {
    expect(shareStamp({ ...member, money: { total: 20, rankedMembers: 64, paidEvents: [] } })).toBeUndefined();
    expect(shareStamp(member)).toEqual({ main: "Money list", detail: "#7" });
  });

  it("picks the biggest moment: championship, ace, match play, then money list", () => {
    const ace = { date: "2026-06-01T00:00:00.000Z", hole: 7 };
    const all: SeasonWrappedMember = {
      ...member,
      championshipsWon: ["Club Champion"],
      closestToPin: { count: 1, holes: [], aces: [ace] },
      bracket: { tournamentTitle: "Match Play", wins: 3, losses: 1, byes: 0, reached: "Final", matches: [] },
      money: { total: 385, rank: 1, rankLabel: "1", rankedMembers: 64, paidEvents: [] },
    };
    expect(shareStamp(all)).toEqual({ main: "Club Champion" });
    expect(shareStamp({ ...all, championshipsWon: ["President's Cup"] })).toEqual({ main: "President's Cup", detail: "Winner" });
    expect(shareStamp({ ...all, championshipsWon: ["Other"] })).toEqual({ main: "Hole in one", detail: "Hole 7" });
    const noAce = { ...all, championshipsWon: [], closestToPin: undefined };
    expect(shareStamp(noAce)).toEqual({ main: "Match play", detail: "Finalist" });
    expect(shareStamp({ ...noAce, bracket: undefined })).toEqual({ main: "Money list", detail: "#1" });
    expect(shareStamp({ ...noAce, bracket: undefined, money: { total: 385, rank: 25, rankLabel: "T25", rankedMembers: 64, paidEvents: [] } })).toEqual({ main: "Money list", detail: "#T25" });
    expect(shareStamp({ ...noAce, bracket: undefined, money: { total: 40, rank: 26, rankLabel: "26", rankedMembers: 64, paidEvents: [] } })).toBeUndefined();
  });

  it("changes the tag color every season and cycles", () => {
    expect(seasonTagColor(2026)).toBe(SEASON_TAG_COLORS[0]);
    expect(seasonTagColor(2027)).not.toBe(seasonTagColor(2026));
    expect(seasonTagColor(2026 + SEASON_TAG_COLORS.length)).toBe(seasonTagColor(2026));
    expect(seasonTagColor(2025)).toBe(SEASON_TAG_COLORS[SEASON_TAG_COLORS.length - 1]);
  });
});

describe("share tag strap", () => {
  it("gives each tag its own clip paths, safe for React useId prefixes", () => {
    const a = tagStrapSvg(72, ":r1:");
    const b = tagStrapSvg(72, ":r2:");
    expect(a).toContain('id="r1-front"');
    expect(a).toContain("url(#r1-front)");
    expect(b).toContain('id="r2-above"');
    expect(a).not.toContain("r2-");
  });
});

describe("money won label", () => {
  it("spells out the Money List finish", () => {
    expect(moneyRankText("1")).toBe("1st");
    expect(moneyRankText("2")).toBe("2nd");
    expect(moneyRankText("T3")).toBe("tied 3rd");
    expect(moneyRankText("11")).toBe("11th");
    expect(moneyRankText("22")).toBe("22nd");
    expect(moneyRankText("x")).toBe("#x");
    expect(moneyWonLabel("T4")).toBe("won, tied 4th on the\u00a0money\u00a0list");
    expect(moneyWonLabel(undefined)).toBe("won");
    expect(moneyWonLabel("4", true)).toBe("won");
  });
});
