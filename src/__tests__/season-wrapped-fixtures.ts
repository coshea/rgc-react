import type {
  SeasonWrappedMember,
  SeasonWrappedSeason,
} from "@@/seasonWrapped/types";

export function makeSeason(
  overrides: Partial<SeasonWrappedSeason> = {},
): SeasonWrappedSeason {
  return {
    year: 2026,
    status: "published",
    memberCount: 3,
    generatedAt: "2026-11-01T12:00:00.000Z",
    generatedBy: "admin",
    club: {
      tournamentCount: 14,
      playerCount: 186,
      teamsRegistered: 412,
      prizeMoneyPaid: 18400,
      holesInOne: 3,
      podium: [
        {
          uid: "jd",
          displayName: "Joe Duarte",
          total: 1105,
          rank: 1,
        },
        {
          uid: "rw",
          displayName: "Ray Wells",
          total: 1020,
          rank: 2,
        },
        {
          uid: "so",
          displayName: "Sam Okafor",
          total: 815,
          rank: 3,
        },
      ],
      majors: [
        {
          key: "club-championship",
          kind: "club-championship",
          label: "Club Championship",
          date: "2026-08-15",
          flights: [
            {
              championshipType: "club-champion",
              label: "Club Champion",
              winnerNames: ["Joe Duarte"],
              winnerIds: ["jd"],
              runnerUpNames: ["Ray Wells"],
              runnerUpIds: ["rw"],
            },
            {
              championshipType: "club-tee-champion",
              label: "Club Tee Champion",
              winnerNames: ["Pete Lind"],
              winnerIds: ["pl"],
              runnerUpNames: ["Mike Reynolds"],
              runnerUpIds: ["me"],
            },
            {
              championshipType: "senior-club-champion",
              label: "Senior Club Champion",
              winnerNames: ["Ray Wells"],
              winnerIds: ["rw"],
              runnerUpNames: [],
              runnerUpIds: [],
            },
          ],
        },
        {
          key: "presidents-cup:p1",
          kind: "major",
          label: "President's Cup",
          date: "2026-06-21",
          winnerNames: ["Sam Okafor"],
          runnerUpNames: ["Pete Lind"],
          fieldSize: "36 players",
        },
      ],
      tribute: {
        heading: "Thank you, Frank.",
        name: "Frank Sergiovanni",
        role: "Superintendent, Ridgefield Golf Course",
        message: "Congratulations on your retirement.",
        stat: "25",
        statLabel: "years of service",
        signoff: "From the RGC Board of Governors and members",
      },
    },
    ...overrides,
  };
}

export function makeStory(
  overrides: Partial<SeasonWrappedMember> = {},
): SeasonWrappedMember {
  return {
    uid: "me",
    year: 2026,
    firstName: "Mike",
    displayName: "Mike Reynolds",
    version: 3,
    generatedAt: "2026-11-01T12:00:00.000Z",
    played: true,
    events: {
      played: 9,
      calendar: 14,
      months: [
        { month: 4, total: 2, played: 1 },
        { month: 5, total: 3, played: 2 },
      ],
      busiestMonth: 5,
    },
    money: {
      total: 385,
      rank: 7,
      rankLabel: "7",
      rankedMembers: 64,
      paidEvents: [
        { tournamentTitle: "Spring Two-Man Scramble", amount: 160, result: "1st" },
        { tournamentTitle: "Club Championship", amount: 120, result: "2nd" },
        { tournamentTitle: "Fall Four-Ball", amount: 80, result: "3rd" },
        { tournamentTitle: "Memorial Day Classic", amount: 25, result: "CTP" },
      ],
    },
    championshipsWon: [],
    majorResults: { "club-championship": "Runner-up, Club Tee" },
    share: { events: 9, total: 385, rankLabel: "7", closestToPins: 0 },
    shareImagePath: "wrapped/2026/me.png",
    ...overrides,
  };
}
