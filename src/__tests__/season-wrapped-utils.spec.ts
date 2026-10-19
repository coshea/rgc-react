import { describe, expect, it } from "vitest";

import type { WrappedAdminRow } from "@/api/seasonWrapped";
import {
  ENGAGEMENT_FILTER,
  matchesFilter,
  summarizeEngagement,
} from "@/components/admin-dashboard/season-wrapped/engagement";
import { aggregateWinnings } from "@/hooks/useYearlyWinnings";
import type { Tournament } from "@/types/tournament";
import { rankStandings } from "@/utils/standings";
import {
  defaultWrappedYear,
  wrappedSourceFromParams,
} from "@/utils/seasonWrapped";
import { computeMoneyList } from "@@/seasonWrapped/stats";
import { makeStory } from "./season-wrapped-fixtures";

describe("Wrapped money list matches the Money List page", () => {
  it("produces the same totals and rank labels as aggregateWinnings + rankStandings", () => {
    const groups = [
      {
        id: "overall",
        label: "Overall",
        type: "overall" as const,
        order: 1,
        winners: [
          { place: 1, prizeAmount: 120, competitors: [{ userId: "a", displayName: "Al" }, { userId: "b", displayName: "Bo" }] },
          { place: 2, prizeAmount: 60, competitors: [{ userId: "c", displayName: "Cy" }] },
        ],
      },
      {
        id: "ctp",
        label: "Closest to Pin",
        type: "closestToPin" as const,
        order: 2,
        winners: [{ place: 1, prizeAmount: 60, holeNumber: 3, competitors: [{ userId: "a", displayName: "Al" }] }],
      },
    ];
    const tournament = {
      firestoreId: "t1",
      title: "Spring Scramble",
      date: new Date("2026-05-02T00:00:00Z"),
      description: "",
      players: 4,
      prizePool: 300,
      winnerGroups: groups,
    } as Tournament & { firestoreId: string };

    const site = rankStandings(aggregateWinnings([tournament]));
    const wrapped = computeMoneyList(
      [{ id: "t1", title: "Spring Scramble", date: tournament.date, winnerGroups: groups }],
      [],
    );

    expect(wrapped.map((r) => [r.uid, r.total, r.rankLabel])).toEqual(
      site.map((r) => [r.userId, r.total, r.rankLabel]),
    );
  });
});

describe("engagement summary", () => {
  const rows: WrappedAdminRow[] = [
    {
      story: makeStory({ uid: "a" }),
      delivery: { uid: "a", emailSentAt: "x", appSentAt: "x", emailClicks: 2 },
      view: {
        uid: "a",
        openCount: 2,
        firstOpenedAt: null,
        lastOpenedAt: null,
        furthestCard: 9,
        cardCount: 9,
        completed: true,
        shared: true,
        firstSource: "email",
        sources: { email: 1, push: 1 },
      },
    },
    { story: makeStory({ uid: "b" }), delivery: { uid: "b", emailSentAt: "x" } },
    { story: makeStory({ uid: "c" }) },
  ];

  it("totals opens, finishes, shares, sends and clicks", () => {
    const s = summarizeEngagement(rows);
    expect(s).toMatchObject({
      members: 3,
      opened: 1,
      finished: 1,
      shared: 1,
      emailSent: 2,
      appSent: 1,
      emailClicked: 1,
    });
    expect(s.opensBySource).toEqual({ email: 1, push: 1, banner: 0, direct: 0 });
  });

  it("filters members by what they've done", () => {
    const ids = (filter: (typeof ENGAGEMENT_FILTER)[keyof typeof ENGAGEMENT_FILTER]) =>
      rows.filter((r) => matchesFilter(r, filter)).map((r) => r.story.uid);
    expect(ids(ENGAGEMENT_FILTER.NOT_OPENED)).toEqual(["b", "c"]);
    expect(ids(ENGAGEMENT_FILTER.SHARED)).toEqual(["a"]);
    expect(ids(ENGAGEMENT_FILTER.NOT_SENT)).toEqual(["c"]);
  });
});

describe("Wrapped helpers", () => {
  it("defaults to this year from October, last year before that", () => {
    expect(defaultWrappedYear(new Date("2026-10-18T12:00:00Z"))).toBe(2026);
    expect(defaultWrappedYear(new Date("2027-02-01T12:00:00Z"))).toBe(2026);
  });

  it("maps utm_source to the visit source", () => {
    expect(wrappedSourceFromParams(new URLSearchParams("utm_source=resend"))).toBe("email");
    expect(wrappedSourceFromParams(new URLSearchParams("utm_source=push"))).toBe("push");
    expect(wrappedSourceFromParams(new URLSearchParams("utm_source=banner"))).toBe("banner");
    expect(wrappedSourceFromParams(new URLSearchParams(""))).toBe("direct");
  });
});
