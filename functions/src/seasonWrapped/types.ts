/**
 * Season Wrapped: a member's year-end recap. Shared by Cloud Functions and the
 * site (imported there as `@@/seasonWrapped/types`), so keep this file free of
 * Node and Firebase imports.
 *
 * Firestore layout (all written by Cloud Functions only, except `views`):
 *   seasonWrapped/{year}                  SeasonWrappedSeason (club half)
 *   seasonWrapped/{year}/members/{uid}    SeasonWrappedMember (overwritten on regenerate)
 *   seasonWrapped/{year}/delivery/{uid}   SeasonWrappedDelivery (admin-only, never overwritten by regenerate)
 *   seasonWrapped/{year}/views/{uid}      SeasonWrappedView (written by the member's own browser)
 *
 * Every link points at `/wrapped/{year}`, so a regenerated story replaces the
 * old one without breaking anything that was already sent.
 */

export const SEASON_WRAPPED_COLLECTION = "seasonWrapped";
export const SEASON_WRAPPED_MEMBERS = "members";
export const SEASON_WRAPPED_DELIVERY = "delivery";
export const SEASON_WRAPPED_VIEWS = "views";

export const SEASON_WRAPPED_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export type SeasonWrappedStatus =
  (typeof SEASON_WRAPPED_STATUS)[keyof typeof SEASON_WRAPPED_STATUS];

/** Delivery channels. Push always rides on the in-app notification doc. */
export const SEASON_WRAPPED_CHANNEL = {
  EMAIL: "email",
  APP: "app",
} as const;

export type SeasonWrappedChannel =
  (typeof SEASON_WRAPPED_CHANNEL)[keyof typeof SEASON_WRAPPED_CHANNEL];

/** Where a visit came from; read from the link's `utm_source`. */
export const SEASON_WRAPPED_SOURCE = {
  EMAIL: "email",
  PUSH: "push",
  BANNER: "banner",
  DIRECT: "direct",
} as const;

export type SeasonWrappedSource =
  (typeof SEASON_WRAPPED_SOURCE)[keyof typeof SEASON_WRAPPED_SOURCE];

/** Resend tag `category` on Wrapped emails (used by resend_webhook). */
export const SEASON_WRAPPED_EMAIL_CATEGORY = "season_wrapped";

/** Path of a member's story on the site. */
export function seasonWrappedPath(year: number): string {
  return `/wrapped/${year}`;
}

/** Storage path of a member's share image. Overwritten on regenerate. */
export function seasonWrappedShareImagePath(year: number, uid: string): string {
  return `wrapped/${year}/${uid}.png`;
}

/** Deterministic in-app notification id, so a re-send can't duplicate it. */
export function seasonWrappedNotificationId(year: number, uid: string): string {
  return `season_wrapped_${year}_${uid}`;
}

// ---------------------------------------------------------------------------
// Club half (same for everyone)
// ---------------------------------------------------------------------------

export interface PodiumEntry {
  uid: string;
  displayName: string;
  total: number;
  /** Shared by tied earners, as on the Money List page. */
  rank: number;
}

/** One flight of the Club Championship (club / club tee / senior). */
export interface ChampionshipFlight {
  championshipType: string;
  label: string;
  winnerNames: string[];
  winnerIds: string[];
  runnerUpNames: string[];
  runnerUpIds: string[];
}

export interface MajorWeather {
  temperature: number;
  windSpeed: number;
}

/**
 * Title patterns for guessing a championship's tournament when the record has
 * no `tournamentId`. The championship editor uses the same guess to pre-fill
 * its tournament picker.
 */
const CHAMPIONSHIP_TOURNAMENT_TITLES: Record<string, RegExp> = {
  "club-champion": /club\s+championship/i,
  "club-tee-champion": /club\s+championship/i,
  "senior-club-champion": /club\s+championship/i,
  "presidents-cup": /president/i,
  "pisano-cup": /pisano/i,
  "team-match-play": /match\s*play/i,
};

/** Latest title match: a multi-day event's final round decides the champion. */
export function guessChampionshipTournament<T extends { title: string; date: Date }>(
  championshipType: string,
  tournaments: Iterable<T>,
): T | undefined {
  const pattern = CHAMPIONSHIP_TOURNAMENT_TITLES[championshipType];
  if (!pattern) return undefined;
  return Array.from(tournaments)
    .filter((t) => pattern.test(t.title))
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
}

export const MAJOR_KIND = {
  CLUB_CHAMPIONSHIP: "club-championship",
  MAJOR: "major",
} as const;

export type MajorKind = (typeof MAJOR_KIND)[keyof typeof MAJOR_KIND];

export interface MajorCard {
  /** Stable key; also the key of the member's `majorResults` line. */
  key: string;
  kind: MajorKind;
  label: string;
  tournamentId?: string;
  /** ISO date (midnight UTC) of the linked tournament. */
  date?: string;
  /** Club Championship only: one entry per flight, in Past Champions order. */
  flights?: ChampionshipFlight[];
  /** Other majors. */
  winnerNames?: string[];
  /** For avatars; may be shorter than winnerNames for historical records. */
  winnerIds?: string[];
  runnerUpNames?: string[];
  runnerUpIds?: string[];
  winningScore?: string;
  /** e.g. "36 players" or "22 teams". */
  fieldSize?: string;
  weather?: MajorWeather;
}

export interface TributeCard {
  heading: string;
  name: string;
  role: string;
  message: string;
  stat: string;
  statLabel: string;
  signoff: string;
}

export interface ClubSeasonStats {
  tournamentCount: number;
  playerCount: number;
  teamsRegistered: number;
  prizeMoneyPaid: number;
  holesInOne: number;
  podium: PodiumEntry[];
  majors: MajorCard[];
  tribute?: TributeCard;
}

export interface AnnouncementLog {
  lastSentAt: string;
  lastSentBy: string;
  totalSent: number;
}

export interface SeasonWrappedSeason {
  year: number;
  status: SeasonWrappedStatus;
  club: ClubSeasonStats;
  /** Members with a story doc. */
  memberCount: number;
  generatedAt: string;
  generatedBy: string;
  publishedAt?: string;
  publishedBy?: string;
  announcements?: Partial<Record<SeasonWrappedChannel, AnnouncementLog>>;
}

// ---------------------------------------------------------------------------
// Member half
// ---------------------------------------------------------------------------

export interface MonthTally {
  /** 0 = January. */
  month: number;
  total: number;
  played: number;
}

export interface CrewStats {
  topPartner?: {
    uid: string;
    displayName: string;
    events: number;
    paidTogether: number;
  };
  distinctTeammates: number;
  goldTeeEvents: number;
}

/** One tournament (or season award) the member won money in. */
export interface PaidEvent {
  tournamentTitle: string;
  amount: number;
  /** Best result there, e.g. "1st", "CTP #12", "Season award". */
  result: string;
}

export interface MoneyStats {
  total: number;
  /** Money List rank; omitted outside the top half. */
  rank?: number;
  rankLabel?: string;
  rankedMembers: number;
  /** Every paid tournament, biggest payout first. */
  paidEvents: PaidEvent[];
}

export interface ClosestToPinStats {
  count: number;
  holes: { hole: number; tournamentTitle: string }[];
  /** `hole` is set when the award recorded one; older awards don't have it. */
  aces: { date: string; tournamentTitle?: string; hole?: number }[];
}

export interface BracketRun {
  tournamentTitle: string;
  wins: number;
  losses: number;
  byes: number;
  /** e.g. "Champions", "Final", "Semifinals". */
  reached: string;
  matches: {
    roundLabel: string;
    opponent?: string;
    /** For avatars, in the same order as the names in `opponent`. */
    opponentIds?: string[];
    won: boolean;
    bye: boolean;
  }[];
}

export interface ShareSummary {
  events: number;
  total: number;
  rankLabel?: string;
  closestToPins: number;
  topPartner?: string;
}

export interface SeasonWrappedMember {
  uid: string;
  year: number;
  firstName: string;
  displayName: string;
  /** Increments on every regenerate; busts the share image cache. */
  version: number;
  generatedAt: string;
  played: boolean;
  events?: {
    played: number;
    calendar: number;
    months: MonthTally[];
    busiestMonth?: number;
    /** Members who played more events; omitted outside the top half. */
    playedMoreCount?: number;
  };
  crew?: CrewStats;
  money?: MoneyStats;
  closestToPin?: ClosestToPinStats;
  bracket?: BracketRun;
  championshipsWon: string[];
  /** Keyed by MajorCard.key; only majors the member placed in. */
  majorResults: Record<string, string>;
  share: ShareSummary;
  shareImagePath: string;
}

/** Admin-only delivery record; regenerate never touches it. */
export interface SeasonWrappedDelivery {
  uid: string;
  emailSentAt?: string;
  appSentAt?: string;
  emailClicks?: number;
  firstEmailClickAt?: string;
  lastEmailClickAt?: string;
  /** Svix ids of counted clicks, so a retried webhook isn't counted twice. */
  emailClickEventIds?: string[];
}

/** Written by the member's own browser (rules restrict fields). */
export interface SeasonWrappedView {
  uid: string;
  openCount: number;
  firstOpenedAt: unknown;
  lastOpenedAt: unknown;
  furthestCard: number;
  cardCount: number;
  completed: boolean;
  shared: boolean;
  firstSource: SeasonWrappedSource;
  sources: Partial<Record<SeasonWrappedSource, number>>;
}

// ---------------------------------------------------------------------------
// Callable payloads
// ---------------------------------------------------------------------------

export interface GenerateSeasonWrappedRequest {
  year: number;
  /** Omit to generate every eligible member. */
  uids?: string[];
}

export interface GenerateSeasonWrappedResponse {
  ok: true;
  generated: number;
  skipped: number;
  shareImagesFailed: number;
}

export interface PublishSeasonWrappedRequest {
  year: number;
  published: boolean;
}

export interface SendSeasonWrappedRequest {
  year: number;
  channels: SeasonWrappedChannel[];
  /** True returns counts without sending anything. */
  dryRun: boolean;
}

export interface ChannelSendCounts {
  eligible: number;
  alreadySent: number;
  optedOut: number;
  /** Email only: bounced/complained addresses or no address. */
  undeliverable: number;
  toSend: number;
  sent: number;
  failed: number;
  /** Why this channel can't send right now, e.g. automated emails are off. */
  blocked?: string;
}

export interface SendSeasonWrappedResponse {
  ok: true;
  dryRun: boolean;
  counts: Partial<Record<SeasonWrappedChannel, ChannelSendCounts>>;
}

export interface SendSeasonWrappedTestRequest {
  year: number;
  /** Whose story to send; defaults to the admin's own. Always delivered to the admin. */
  uid?: string;
}

export interface GetShareImageRequest {
  year: number;
  /** Admins may fetch another member's image. */
  uid?: string;
}

export interface GetShareImageResponse {
  ok: true;
  /** Base64 PNG. */
  image: string;
  version: number;
}

// ---------------------------------------------------------------------------
// Board-written content
// ---------------------------------------------------------------------------

/** Tribute card per season, written by the board. */
export const SEASON_TRIBUTES: Record<number, TributeCard> = {
  2026: {
    heading: "Thank you, Frank.",
    name: "Frank Sergiovanni",
    role: "Superintendent, Ridgefield Golf Course",
    message:
      "Congratulations on your retirement. Without Frank's contributions and help, the men's club wouldn't be possible.",
    stat: "25",
    statLabel: "years of service",
    signoff: "From the RGC Board of Governors and members",
  },
};
