import { describe, expect, it } from "vitest";

import {
  bracketRunFor,
  buildSeasonContext,
  computeClubStats,
  computeMemberStory,
  computeMoneyList,
  eligibleUsers,
  inTopHalf,
  paidEventsFor,
  seasonTournaments,
  type WrappedRegistration,
  type WrappedSeasonInput,
  type WrappedTournament,
} from "../seasonWrapped/stats";

const YEAR = 2026;
const NOW = new Date("2026-11-01T00:00:00Z");

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function tournament(
  id: string,
  date: string,
  extra: Partial<WrappedTournament> = {},
): WrappedTournament {
  return { id, title: `T ${id}`, date: day(date), status: "Completed", winnerGroups: [], ...extra };
}

function reg(
  id: string,
  tournamentId: string,
  members: string[],
  goldTee: string[] = [],
): WrappedRegistration {
  return {
    id,
    tournamentId,
    memberIds: members,
    team: members.map((m) => ({ id: m, displayName: m.toUpperCase(), goldTee: goldTee.includes(m) })),
  };
}

function baseInput(overrides: Partial<WrappedSeasonInput> = {}): WrappedSeasonInput {
  return {
    year: YEAR,
    now: NOW,
    tournaments: [],
    registrations: [],
    brackets: [],
    seasonAwards: [],
    championships: [],
    users: [],
    paidUids: new Set(),
    ...overrides,
  };
}

describe("seasonTournaments", () => {
  it("keeps played, non-canceled tournaments in the year by UTC date", () => {
    const input = baseInput({
      tournaments: [
        tournament("a", "2026-01-01"),
        tournament("b", "2025-12-31"),
        tournament("c", "2026-06-01", { status: "Canceled" }),
        tournament("d", "2026-12-01", { status: "Upcoming" }),
        tournament("e", "2026-05-01", { status: "Upcoming" }),
      ],
    });
    expect(seasonTournaments(input).map((t) => t.id)).toEqual(["a", "e"]);
  });
});

describe("computeMoneyList", () => {
  it("ranks like the Money List page, with ties sharing a rank", () => {
    const rows = computeMoneyList(
      [
        tournament("t1", "2026-05-01", {
          winnerGroups: [
            {
              id: "g",
              label: "Overall",
              type: "overall",
              winners: [
                { place: 1, prizeAmount: 100, competitors: [{ userId: "a", displayName: "Al" }, { userId: "b", displayName: "Bo" }] },
                { place: 2, prizeAmount: 50, competitors: [{ userId: "c", displayName: "Cy" }] },
              ],
            },
          ],
        }),
      ],
      [
        { id: "aw", userId: "c", userDisplayName: "Cy", awardType: "hole_in_one", amount: 50, date: day("2026-07-01") },
      ],
    );
    expect(rows.map((r) => [r.uid, r.total, r.rankLabel])).toEqual([
      ["a", 100, "T1"],
      ["b", 100, "T1"],
      ["c", 100, "T1"],
    ]);
  });
});

describe("member story", () => {
  const tournaments = [
    tournament("t1", "2026-05-02", {
      weather: { temperature: 70, windSpeed: 5, precipitation: 0 },
      winnerGroups: [
        {
          id: "o",
          label: "Overall",
          type: "overall",
          winners: [
            { place: 1, prizeAmount: 80, competitors: [{ userId: "me", displayName: "Me" }, { userId: "pal", displayName: "Pal" }] },
          ],
        },
        {
          id: "ctp",
          label: "Closest to Pin",
          type: "closestToPin",
          winners: [{ place: 1, holeNumber: 12, prizeAmount: 20, competitors: [{ userId: "me", displayName: "Me" }] }],
        },
      ],
    }),
    tournament("t2", "2026-06-06", {
      weather: { temperature: 90, windSpeed: 18, precipitation: 0.4 },
    }),
    tournament("t3", "2026-06-20"),
  ];
  const registrations = [
    reg("r1", "t1", ["me", "pal"], ["me"]),
    reg("r2", "t2", ["me", "pal"]),
    reg("r3", "t3", ["me", "other"]),
    reg("r4", "t1", ["slow"]),
    reg("r5", "t2", ["slow"]),
    reg("r6", "t3", ["slow"]),
  ];
  const input = baseInput({
    tournaments,
    registrations,
    users: [
      { uid: "me", firstName: "Mike", displayName: "Mike R" },
      { uid: "pal", displayName: "Pal Person" },
      { uid: "slow", displayName: "Slow Poke" },
      { uid: "paid", displayName: "Paid Only" },
      { uid: "gone", displayName: "Migrated", isMigrated: true },
    ],
    paidUids: new Set(["paid", "gone"]),
  });
  const ctx = buildSeasonContext(input);
  const story = computeMemberStory(input.users[0], input, ctx, { version: 1, generatedAt: "now" });

  it("counts events, months and busiest month", () => {
    expect(story.played).toBe(true);
    expect(story.events?.played).toBe(3);
    expect(story.events?.calendar).toBe(3);
    expect(story.events?.busiestMonth).toBe(5);
  });

  it("finds the top partner and gold tee events", () => {
    expect(story.crew?.topPartner).toMatchObject({ uid: "pal", events: 2, paidTogether: 1 });
    expect(story.crew?.distinctTeammates).toBe(2);
    expect(story.crew?.goldTeeEvents).toBe(1);
  });

  it("totals winnings and lists closest-to-pin holes", () => {
    expect(story.money?.total).toBe(100);
    expect(story.money?.rankLabel).toBe("1");
    // One line per paid tournament: $80 for 1st plus $20 closest to pin at t1.
    expect(story.money?.paidEvents).toEqual([
      { tournamentTitle: "T t1", amount: 100, result: "1st" },
    ]);
    expect(story.closestToPin?.holes).toEqual([{ hole: 12, tournamentTitle: "T t1" }]);
  });

  it("leaves out money when the member doesn't qualify", () => {
    const slow = computeMemberStory(input.users[2], input, ctx, { version: 1, generatedAt: "now" });
    expect(slow.money).toBeUndefined();
  });

  it("includes paid members who didn't play and skips migrated users", () => {
    expect(eligibleUsers(input, ctx).map((u) => u.uid)).toEqual(["me", "pal", "slow", "paid"]);
    const paid = computeMemberStory(input.users[3], input, ctx, { version: 1, generatedAt: "now" });
    expect(paid.played).toBe(false);
    expect(paid.events).toBeUndefined();
    expect(paid.share.events).toBe(0);
  });
});

describe("club stats and majors", () => {
  it("builds one Club Championship card with every flight in Past Champions order", () => {
    const input = baseInput({
      tournaments: [tournament("cc", "2026-08-15")],
      championships: [
        { id: "s", championshipType: "senior-club-champion", winnerNames: ["Ray"], winnerIds: ["ray"], tournamentId: "cc" },
        { id: "c", championshipType: "club-champion", winnerNames: ["Joe"], winnerIds: ["joe"], runnerUpNames: ["Ray"], runnerUpIds: ["ray"], tournamentId: "cc" },
        { id: "p", championshipType: "presidents-cup", winnerNames: ["Sam"], winnerIds: ["sam"] },
      ],
      users: [{ uid: "ray", displayName: "Ray Wells" }],
      paidUids: new Set(["ray"]),
    });
    const ctx = buildSeasonContext(input);
    const club = computeClubStats(input, ctx);
    const [clubChamp, presidents] = club.majors;
    expect(clubChamp.kind).toBe("club-championship");
    expect(clubChamp.date).toBe("2026-08-15");
    expect(clubChamp.flights?.map((f) => f.championshipType)).toEqual([
      "club-champion",
      "senior-club-champion",
    ]);
    expect(presidents.label).toBe("President's Cup");
    expect(club.tribute?.name).toBe("Frank Sergiovanni");

    const ray = computeMemberStory(input.users[0], input, ctx, { version: 1, generatedAt: "now" });
    expect(ray.majorResults["club-championship"]).toBe("Runner-up, Club · Champion, Senior Club");
  });
});

describe("majors without a tournament link", () => {
  it("finds the tournament by title and shows the champion's score", () => {
    const input = baseInput({
      tournaments: [
        tournament("pc", "2026-06-21", {
          title: "2026 President's Cup",
          weather: { temperature: 91, windSpeed: 4, precipitation: 0 },
          winnerGroups: [
            {
              id: "net",
              label: "Net",
              type: "custom",
              winners: [{ place: 1, score: "68 net", competitors: [{ userId: "sam", displayName: "Sam" }] }],
            },
            {
              id: "gross",
              label: "Gross",
              type: "custom",
              winners: [{ place: 1, score: "74", competitors: [{ userId: "pl", displayName: "Pete" }] }],
            },
          ],
        }),
        tournament("mp", "2026-09-01", { title: "Team Match Play Final" }),
      ],
      registrations: [reg("r1", "pc", ["sam"]), reg("r2", "pc", ["pl"])],
      championships: [
        { id: "p", championshipType: "presidents-cup", winnerNames: ["Sam Okafor"], winnerIds: ["sam"], runnerUpNames: ["Pete Lind"], runnerUpIds: ["pl"] },
        { id: "m", championshipType: "team-match-play", winnerNames: ["Bob Hanlon", "Al Price"], winnerIds: ["bh", "ap"] },
      ],
    });
    const club = computeClubStats(input, buildSeasonContext(input));
    const presidents = club.majors.find((m) => m.key === "presidents-cup:p")!;
    expect(presidents).toMatchObject({
      tournamentId: "pc",
      date: "2026-06-21",
      winningScore: "68 net",
      fieldSize: "2 players",
      runnerUpIds: ["pl"],
    });
    const matchPlay = club.majors.find((m) => m.key === "team-match-play:m")!;
    expect(matchPlay.tournamentId).toBe("mp");
    expect(matchPlay.winnerIds).toEqual(["bh", "ap"]);
  });
});

describe("bracketRunFor", () => {
  it("counts wins and losses, treats empty slots as byes", () => {
    const input = baseInput({ tournaments: [tournament("mp", "2026-07-01")] });
    const ctx = buildSeasonContext(input);
    const run = bracketRunFor(
      "me",
      [
        {
          tournamentId: "mp",
          teams: [
            { id: "A", name: "Me", memberIds: ["me"], memberNames: ["Mike Reynolds"] },
            { id: "B", name: "B", memberIds: ["b"], memberNames: ["Bob Hanlon"] },
            { id: "C", name: "C", memberIds: ["c", "d"], memberNames: ["Cal Duarte", "Dan Wells"] },
          ],
          matches: [
            { id: "1", round: 1, position: 0, team1Id: "A", team2Id: null, winnerId: "A" },
            { id: "2", round: 2, position: 0, team1Id: "A", team2Id: "B", winnerId: "A" },
            { id: "3", round: 3, position: 0, team1Id: "A", team2Id: "C", winnerId: "C" },
          ],
        },
      ],
      ctx,
    );
    expect(run).toMatchObject({ wins: 1, losses: 1, byes: 1, reached: "Final" });
    expect(run?.matches[1].opponent).toBe("Bob Hanlon");
    expect(run?.matches[2].opponent).toBe("Cal Duarte & Dan Wells");
    expect(run?.matches[2].opponentIds).toEqual(["c", "d"]);
  });
});

describe("paidEventsFor", () => {
  it("lists every paid tournament and season award, biggest first", () => {
    const [row] = computeMoneyList(
      [
        tournament("a", "2026-05-01", {
          title: "Spring Scramble",
          winnerGroups: [
            {
              id: "ctp",
              label: "Closest to Pin",
              type: "closestToPin",
              winners: [{ place: 1, holeNumber: 3, prizeAmount: 25, competitors: [{ userId: "me", displayName: "Me" }] }],
            },
          ],
        }),
        tournament("b", "2026-06-01", {
          title: "Member-Guest",
          winnerGroups: [
            {
              id: "f",
              label: "Flight B",
              type: "flight",
              winners: [{ place: 2, prizeAmount: 60, competitors: [{ userId: "me", displayName: "Me" }] }],
            },
          ],
        }),
      ],
      [{ id: "h", userId: "me", userDisplayName: "Me", awardType: "hole_in_one", amount: 50, date: day("2026-08-09") }],
    );
    expect(paidEventsFor(row)).toEqual([
      { tournamentTitle: "Member-Guest", amount: 60, result: "2nd" },
      { tournamentTitle: "Hole in one award", amount: 50, result: "Hole in one" },
      { tournamentTitle: "Spring Scramble", amount: 25, result: "CTP" },
    ]);
  });
});

describe("aces", () => {
  it("keeps the hole when the award has one", () => {
    const input = baseInput({
      users: [{ uid: "me", displayName: "Me" }],
      paidUids: new Set(["me"]),
      seasonAwards: [
        { id: "a1", userId: "me", userDisplayName: "Me", awardType: "hole_in_one", amount: 50, date: day("2026-07-01"), holeNumber: 7 },
        { id: "a2", userId: "me", userDisplayName: "Me", awardType: "hole_in_one", amount: 50, date: day("2026-08-01") },
      ],
    });
    const story = computeMemberStory(input.users[0], input, buildSeasonContext(input), { version: 1, generatedAt: "now" });
    expect(story.closestToPin?.aces).toEqual([
      { date: "2026-07-01", hole: 7 },
      { date: "2026-08-01" },
    ]);
  });
});

describe("inTopHalf", () => {
  it("includes the middle position for odd totals", () => {
    expect(inTopHalf(3, 5)).toBe(true);
    expect(inTopHalf(4, 5)).toBe(false);
    expect(inTopHalf(1, 0)).toBe(false);
  });
});
