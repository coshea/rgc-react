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
 *   seasonWrapped/{year}/generation/{uid} SeasonWrappedGeneration (admin-only, the member's last generate run)
 *
 * Every link points at `/wrapped/{year}`, so a regenerated story replaces the
 * old one without breaking anything that was already sent.
 */

export const SEASON_WRAPPED_COLLECTION = "seasonWrapped";
export const SEASON_WRAPPED_MEMBERS = "members";
export const SEASON_WRAPPED_DELIVERY = "delivery";
export const SEASON_WRAPPED_VIEWS = "views";
export const SEASON_WRAPPED_GENERATION = "generation";

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

/** Where a member is in a generate run, so the admin list can show it live. */
export const SEASON_WRAPPED_GENERATION_STATUS = {
  PENDING: "pending",
  DONE: "done",
  /** Selected, but no payment or event that year. */
  SKIPPED: "skipped",
  /**
   * The share image failed (it's made when first opened instead), or the run
   * errored before this member finished. `error` says which.
   */
  FAILED: "failed",
} as const;

export type SeasonWrappedGenerationStatus =
  (typeof SEASON_WRAPPED_GENERATION_STATUS)[keyof typeof SEASON_WRAPPED_GENERATION_STATUS];

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
  /** Keyed by MajorCard.key; only majors the member won money in or, for brackets, the round reached. */
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

/** Admin-only; rewritten by every generate run that includes the member. */
export interface SeasonWrappedGeneration {
  uid: string;
  status: SeasonWrappedGenerationStatus;
  runId: string;
  /** ISO time of the last status change. */
  updatedAt: string;
  error?: string;
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
  runId: string;
  generated: number;
  skipped: number;
  /** Selected members who weren't eligible. */
  skippedUids: string[];
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

// ---------------------------------------------------------------------------
// Share tag (functions/src/seasonWrapped/shareImage.ts and the site's share card)
// ---------------------------------------------------------------------------

/**
 * The bag tag's band color changes every season, the way real member bag
 * tags do. Cycles from 2026; each color carries white text.
 */
export const SEASON_TAG_COLORS = ["#2c8a4b", "#1f4e8c", "#8c2f39", "#1d6f73", "#6a4a94"] as const;

export function seasonTagColor(year: number): string {
  const n = SEASON_TAG_COLORS.length;
  return SEASON_TAG_COLORS[(((year - 2026) % n) + n) % n];
}

/** A gold seal on the tag for the member's biggest moment of the season. */
export interface ShareStamp {
  main: string;
  detail?: string;
}

/** The Money List seal's title. */
export const MONEY_LIST_SEAL = "Money list";

/** Money List ranks that earn a seal. */
export const STAMP_MONEY_RANK = 25;

/**
 * At most one seal, in order: a championship, a hole-in-one, a match play
 * final, a top-25 Money List finish.
 */
export function shareStamp(member: SeasonWrappedMember): ShareStamp | undefined {
  const title = member.championshipsWon.find((t) => t !== "Other");
  if (title) {
    return /champion/i.test(title) ? { main: title } : { main: title, detail: "Winner" };
  }
  const aces = member.closestToPin?.aces ?? [];
  if (aces.length > 0) {
    const hole = aces.length === 1 ? aces[0].hole : undefined;
    return {
      main: "Hole in one",
      ...(aces.length > 1 ? { detail: `${aces.length} aces` } : hole ? { detail: `Hole ${hole}` } : {}),
    };
  }
  const reached = member.bracket?.reached;
  if (reached === "Champions") return { main: "Match play", detail: "Champion" };
  if (reached === "Final") return { main: "Match play", detail: "Finalist" };
  const rank = member.money?.rank;
  if (rank && rank <= STAMP_MONEY_RANK && member.money?.rankLabel) {
    return { main: MONEY_LIST_SEAL, detail: `#${member.money.rankLabel}` };
  }
  return undefined;
}

/**
 * The tag's grommet and leather strap, in tag pixels (the tag is 700 wide;
 * y = 0 is its top edge). The share image draws them at 1:1 and the site's
 * card scales them, so both show the same loop: the front strand comes down
 * over the tag into the grommet, the back strand rises from behind the tag.
 */
export const TAG_GROMMET = { x: 350, y: 90, r: 50, ring: 10 } as const;
export const TAG_STRAP_COLORS = {
  front: "#d4553a",
  back: "#a8442d",
  stitch: "#8a3422",
  /** The strap seen through the grommet. */
  inHole: "#6e2a1b",
  ring: "#ead9b3",
} as const;
const STRAP_WIDTH = 36;

/**
 * SVG markup (no outer element) for the strap and the grommet's lower lip,
 * for a viewBox of `0 ${-rise} 700 ${rise + 150}`: `rise` is how much strap
 * shows above the tag. Draw it over the tag.
 */
export function tagStrapSvg(rise: number, idPrefix = "tag"): string {
  // Unique ids so two tags on one page don't share clip paths.
  const above = `${idPrefix}-above`.replace(/[^\w-]/g, "");
  const inFront = `${idPrefix}-front`.replace(/[^\w-]/g, "");
  const { x, y, r, ring } = TAG_GROMMET;
  const top = -rise - 20;
  const inner = r - ring;
  // Runs down into the hole and disappears under its lower lip.
  const front = `M${x - 60} ${top} C${x - 60} ${y - 70} ${x - 6} ${y - 40} ${x - 2} ${y + inner}`;
  const back = `M${x + 60} ${top} C${x + 60} ${y - 70} ${x + 26} ${y - 40} ${x + 20} ${y + 10}`;
  const lip = `M${x - r + ring / 2} ${y} A${r - ring / 2} ${r - ring / 2} 0 0 0 ${x + r - ring / 2} ${y}`;
  const strand = (d: string, color: string) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${STRAP_WIDTH}"/>` +
    `<path d="${d}" fill="none" stroke="${TAG_STRAP_COLORS.stitch}" stroke-width="2.5" stroke-dasharray="10 8"/>`;
  return (
    // The back strand only shows above the tag.
    `<defs><clipPath id="${above}"><rect x="0" y="${top}" width="700" height="${-top}"/></clipPath>` +
    // The front strand shows above the hole's center and inside the hole.
    `<clipPath id="${inFront}"><rect x="0" y="${top}" width="700" height="${y - top}"/>` +
    `<circle cx="${x}" cy="${y}" r="${inner}"/></clipPath></defs>` +
    `<g clip-path="url(#${above})">${strand(back, TAG_STRAP_COLORS.back)}</g>` +
    `<g clip-path="url(#${inFront})">${strand(front, TAG_STRAP_COLORS.front)}</g>` +
    `<path d="${lip}" fill="none" stroke="${TAG_STRAP_COLORS.ring}" stroke-width="${ring}"/>`
  );
}

/** "4" → "4th", "T12" → "tied 12th"; anything else is shown as "#label". */
export function moneyRankText(rankLabel: string): string {
  const tied = /^T/i.test(rankLabel);
  const n = Number(rankLabel.replace(/^T/i, ""));
  if (!Number.isInteger(n) || n <= 0) return `#${rankLabel}`;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${tied ? "tied " : ""}${n}${suffix}`;
}

/**
 * Label under the money won: plain "won" when there's no rank or the seal
 * already shows it, otherwise e.g. "won, 4th on the money list".
 */
export function moneyWonLabel(rankLabel: string | undefined, sealShowsRank = false): string {
  // Non-breaking spaces keep "the money list" together when the label wraps.
  return rankLabel && !sealShowsRank ? `won, ${moneyRankText(rankLabel)} on the\u00a0money\u00a0list` : "won";
}

/** True when the member's seal is their Money List finish. */
export function sealShowsMoneyRank(member: SeasonWrappedMember): boolean {
  return shareStamp(member)?.main === MONEY_LIST_SEAL;
}
