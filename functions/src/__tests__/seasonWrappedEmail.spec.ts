import { describe, expect, it } from "vitest";

import {
  buildSeasonWrappedEmail,
  headlineStats,
  seasonWrappedUidTag,
  uidFromSeasonWrappedTags,
} from "../seasonWrapped/email";
import { shareStats } from "../seasonWrapped/shareImage";
import type {
  ClubSeasonStats,
  SeasonWrappedMember,
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
      { value: "$385", label: "won · #7" },
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
    expect(email.subject).toBe("Your 2026 season at RGC is ready");
    expect(email.html).toContain(
      "https://ridgefieldgolfclub.org/wrapped/2026?utm_source=resend&amp;utm_medium=email&amp;utm_campaign=season_wrapped_2026",
    );
    expect(email.text).toContain("a thank-you to Frank Sergiovanni");
    expect(email.tags).toEqual([
      { name: "category", value: "season_wrapped" },
      { name: "year", value: "2026" },
      { name: "uid", value: "uid_1" },
    ]);
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
      "won · #7",
      "closest to pins",
      "top partner",
    ]);
  });

  it("falls back to membership for members with nothing to show", () => {
    const quiet = { ...member, share: { events: 0, total: 0, closestToPins: 0 } };
    expect(shareStats(quiet)).toEqual([{ value: "2026", label: "RGC member" }]);
  });
});
