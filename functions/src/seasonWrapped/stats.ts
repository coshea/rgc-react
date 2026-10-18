/**
 * Pure Season Wrapped calculations. No Firestore access here: the generate
 * function loads the season's data, normalizes it into `WrappedSeasonInput`,
 * and these functions turn it into the club half and each member's story.
 */
import {
  MAJOR_KIND,
  SEASON_TRIBUTES,
  seasonWrappedShareImagePath,
  type BracketRun,
  type ChampionshipFlight,
  type ClubSeasonStats,
  type MajorCard,
  type PaidEvent,
  type PodiumEntry,
  type SeasonWrappedMember,
  type SignupSpeed,
} from "./types";

// ---------------------------------------------------------------------------
// Input shapes (normalized from Firestore by the caller)
// ---------------------------------------------------------------------------

export interface WrappedCompetitor {
  userId: string;
  displayName: string;
}

export interface WrappedWinnerPlace {
  place: number;
  competitors: WrappedCompetitor[];
  prizeAmount?: number;
  score?: string;
  holeNumber?: number;
}

export interface WrappedWinnerGroup {
  id: string;
  label: string;
  type: string;
  holeNumber?: number;
  winners: WrappedWinnerPlace[];
}

export interface WrappedTournament {
  id: string;
  title: string;
  /** Midnight UTC. */
  date: Date;
  status?: string;
  registrationStart?: Date;
  weather?: { temperature: number; windSpeed: number; precipitation: number };
  winnerGroups: WrappedWinnerGroup[];
}

export interface WrappedRegistration {
  id: string;
  tournamentId: string;
  ownerId?: string;
  memberIds: string[];
  team: { id: string; displayName: string; goldTee?: boolean }[];
  registeredAt?: Date;
}

export interface WrappedBracket {
  tournamentId: string;
  teams: { id: string; name: string; memberIds: string[]; memberNames?: string[] }[];
  matches: {
    id: string;
    round: number;
    position: number;
    team1Id: string | null;
    team2Id: string | null;
    winnerId: string | null;
  }[];
}

export interface WrappedSeasonAward {
  id: string;
  userId: string;
  userDisplayName: string;
  awardType: string;
  amount: number;
  date: Date;
  tournamentTitle?: string;
}

export interface WrappedChampionship {
  id: string;
  championshipType: string;
  winnerNames: string[];
  winnerIds?: string[];
  runnerUpNames?: string[];
  runnerUpIds?: string[];
  tournamentId?: string;
}

export interface WrappedUser {
  uid: string;
  firstName?: string;
  displayName?: string;
  isMigrated?: boolean;
}

export interface WrappedSeasonInput {
  year: number;
  /** Tournaments dated after this haven't been played yet. */
  now: Date;
  /** Every tournament dated in the year, including canceled ones. */
  tournaments: WrappedTournament[];
  registrations: WrappedRegistration[];
  brackets: WrappedBracket[];
  seasonAwards: WrappedSeasonAward[];
  championships: WrappedChampionship[];
  findAGamePosts: number;
  users: WrappedUser[];
  /** Members with a confirmed dues payment for the year. */
  paidUids: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANCELED = "Canceled";
const HOLE_IN_ONE = "hole_in_one";
const CLOSEST_TO_PIN = "closestToPin";
/** Fewest captain registrations before signup speed means anything. */
const MIN_SIGNUPS_FOR_SPEED = 3;
const MIN_EVENTS_FOR_MONTHS = 3;
const MIN_SHARED_EVENTS_FOR_PARTNER = 2;

/** Same labels as CHAMPIONSHIP_TYPES in src/types/championship.ts. */
export const CHAMPIONSHIP_LABELS: Record<string, string> = {
  "club-champion": "Club Champion",
  "club-tee-champion": "Club Tee Champion",
  "senior-club-champion": "Senior Club Champion",
  "presidents-cup": "President's Cup",
  "pisano-cup": "The Pisano Cup",
  "team-match-play": "Team Match Play",
  other: "Other",
};

/** Club Championship flights, in Past Champions order. */
export const CLUB_CHAMPIONSHIP_FLIGHTS = [
  "club-champion",
  "club-tee-champion",
  "senior-club-champion",
] as const;

const OTHER_MAJOR_ORDER = ["presidents-cup", "pisano-cup", "team-match-play"];

const CLUB_CHAMPIONSHIP_KEY = "club-championship";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function byName(a: string, b: string): number {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  return A < B ? -1 : A > B ? 1 : 0;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True when `position` (1 = best) is in the top half of `total`. */
export function inTopHalf(position: number, total: number): boolean {
  return total > 0 && position <= Math.ceil(total / 2);
}

function firstNameOf(user: WrappedUser): string {
  const name = user.firstName?.trim() || user.displayName?.trim();
  return name ? name.split(/\s+/)[0] : "Member";
}


/** Tournaments that count for the season: dated in the year, played, not canceled. */
export function seasonTournaments(input: WrappedSeasonInput): WrappedTournament[] {
  return input.tournaments
    .filter(
      (t) =>
        t.date.getUTCFullYear() === input.year &&
        t.status !== CANCELED &&
        t.date.getTime() <= input.now.getTime(),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------------------------------------------------------------------------
// Money list (mirrors aggregateWinnings + rankStandings on the Money List page)
// ---------------------------------------------------------------------------

export interface MoneyListItem {
  tournamentId: string;
  title: string;
  groupLabel: string;
  groupType: string;
  amount: number;
  place: number;
  source: "tournament" | "season-award";
}

export interface MoneyListRow {
  uid: string;
  displayName: string;
  total: number;
  rank: number;
  rankLabel: string;
  items: MoneyListItem[];
}

export function computeMoneyList(
  tournaments: readonly WrappedTournament[],
  seasonAwards: readonly WrappedSeasonAward[],
): MoneyListRow[] {
  const rows = new Map<string, Omit<MoneyListRow, "rank" | "rankLabel">>();
  const add = (uid: string, displayName: string, item: MoneyListItem) => {
    const row = rows.get(uid);
    if (row) {
      row.total += item.amount;
      row.items.push(item);
    } else {
      rows.set(uid, { uid, displayName, total: item.amount, items: [item] });
    }
  };

  for (const t of tournaments) {
    for (const g of t.winnerGroups) {
      for (const w of g.winners) {
        const amount = w.prizeAmount || 0;
        if (amount <= 0) continue;
        for (const c of w.competitors) {
          add(c.userId, c.displayName || c.userId, {
            tournamentId: t.id,
            title: t.title,
            groupLabel: g.label,
            groupType: g.type,
            amount,
            place: w.place,
            source: "tournament",
          });
        }
      }
    }
  }
  for (const a of seasonAwards) {
    const label = a.awardType === HOLE_IN_ONE ? "Hole in one" : "Season award";
    add(a.userId, a.userDisplayName || a.userId, {
      tournamentId: `season-award:${a.id}`,
      title: a.tournamentTitle ?? `${label} award`,
      groupLabel: label,
      groupType: "season-award",
      amount: a.amount,
      place: 0,
      source: "season-award",
    });
  }

  const sorted = Array.from(rows.values()).sort((a, b) =>
    b.total !== a.total ? b.total - a.total : byName(a.displayName, b.displayName),
  );
  return sorted.map((row) => {
    const rank = 1 + sorted.filter((o) => o.total > row.total).length;
    const tied = sorted.filter((o) => o.total === row.total).length > 1;
    return { ...row, rank, rankLabel: `${tied ? "T" : ""}${rank}` };
  });
}

// ---------------------------------------------------------------------------
// Club half
// ---------------------------------------------------------------------------

function fieldSizeFor(regs: readonly WrappedRegistration[]): string | undefined {
  if (regs.length === 0) return undefined;
  const teams = regs.some((r) => r.memberIds.length > 1);
  return teams ? `${regs.length} teams` : `${regs.length} players`;
}

function winningScoreFor(t: WrappedTournament | undefined): string | undefined {
  const overall = t?.winnerGroups.find((g) => g.type === "overall");
  return overall?.winners.find((w) => w.place === 1)?.score?.trim() || undefined;
}

export function buildMajors(
  championships: readonly WrappedChampionship[],
  tournamentsById: ReadonlyMap<string, WrappedTournament>,
  regsByTournament: ReadonlyMap<string, WrappedRegistration[]>,
): MajorCard[] {
  const majors: MajorCard[] = [];

  const flights: ChampionshipFlight[] = [];
  let clubTournamentId: string | undefined;
  for (const type of CLUB_CHAMPIONSHIP_FLIGHTS) {
    for (const c of championships.filter((x) => x.championshipType === type)) {
      flights.push({
        championshipType: type,
        label: CHAMPIONSHIP_LABELS[type],
        winnerNames: c.winnerNames,
        winnerIds: c.winnerIds ?? [],
        runnerUpNames: c.runnerUpNames ?? [],
        runnerUpIds: c.runnerUpIds ?? [],
      });
      clubTournamentId ??= c.tournamentId;
    }
  }
  if (flights.length > 0) {
    const t = clubTournamentId ? tournamentsById.get(clubTournamentId) : undefined;
    majors.push({
      key: CLUB_CHAMPIONSHIP_KEY,
      kind: MAJOR_KIND.CLUB_CHAMPIONSHIP,
      label: "Club Championship",
      ...(clubTournamentId ? { tournamentId: clubTournamentId } : {}),
      ...(t ? { date: isoDate(t.date) } : {}),
      flights,
    });
  }

  const others = championships
    .filter(
      (c) =>
        !(CLUB_CHAMPIONSHIP_FLIGHTS as readonly string[]).includes(c.championshipType) &&
        c.championshipType !== "other",
    )
    .map((c) => {
      const t = c.tournamentId ? tournamentsById.get(c.tournamentId) : undefined;
      const fieldSize = c.tournamentId
        ? fieldSizeFor(regsByTournament.get(c.tournamentId) ?? [])
        : undefined;
      const winningScore = winningScoreFor(t);
      const card: MajorCard = {
        key: `${c.championshipType}:${c.id}`,
        kind: MAJOR_KIND.MAJOR,
        label: CHAMPIONSHIP_LABELS[c.championshipType] ?? c.championshipType,
        winnerNames: c.winnerNames,
        winnerIds: c.winnerIds ?? [],
        runnerUpNames: c.runnerUpNames ?? [],
        ...(c.tournamentId ? { tournamentId: c.tournamentId } : {}),
        ...(t ? { date: isoDate(t.date) } : {}),
        ...(winningScore ? { winningScore } : {}),
        ...(fieldSize ? { fieldSize } : {}),
        ...(t?.weather
          ? {
              weather: {
                temperature: t.weather.temperature,
                windSpeed: t.weather.windSpeed,
              },
            }
          : {}),
      };
      return card;
    })
    .sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
      const typeA = OTHER_MAJOR_ORDER.indexOf(a.key.split(":")[0]);
      const typeB = OTHER_MAJOR_ORDER.indexOf(b.key.split(":")[0]);
      return typeA - typeB;
    });

  return [...majors, ...others];
}

export function computeClubStats(
  input: WrappedSeasonInput,
  ctx: SeasonContext,
): ClubSeasonStats {
  const players = new Set<string>();
  for (const r of ctx.seasonRegs) r.memberIds.forEach((id) => players.add(id));

  const podium: PodiumEntry[] = ctx.moneyList
    .filter((row) => row.rank <= 3)
    .slice(0, 3)
    .map((row) => ({
      uid: row.uid,
      displayName: row.displayName,
      total: row.total,
      rank: row.rank,
      paidFinishes: row.items.length,
    }));

  const tribute = SEASON_TRIBUTES[input.year];
  return {
    tournamentCount: ctx.tournaments.length,
    playerCount: players.size,
    teamsRegistered: ctx.seasonRegs.length,
    prizeMoneyPaid: ctx.moneyList.reduce((sum, row) => sum + row.total, 0),
    holesInOne: input.seasonAwards.filter((a) => a.awardType === HOLE_IN_ONE).length,
    findAGamePosts: input.findAGamePosts,
    podium,
    podiumTotal: podium.reduce((sum, p) => sum + p.total, 0),
    podiumPaidFinishes: podium.reduce((sum, p) => sum + p.paidFinishes, 0),
    majors: ctx.majors,
    ...(tribute ? { tribute } : {}),
  };
}

// ---------------------------------------------------------------------------
// Season context: everything computed once and shared by every member
// ---------------------------------------------------------------------------

export interface SeasonContext {
  tournaments: WrappedTournament[];
  tournamentsById: Map<string, WrappedTournament>;
  seasonRegs: WrappedRegistration[];
  regsByTournament: Map<string, WrappedRegistration[]>;
  /** uid -> registrations (one per tournament). */
  regsByUid: Map<string, WrappedRegistration[]>;
  moneyList: MoneyListRow[];
  /** uid -> median signup minutes, for captains with enough signups. */
  signupMedians: Map<string, number>;
  /** Event counts for everyone who played. */
  eventCounts: Map<string, number>;
  majors: MajorCard[];
}

export function buildSeasonContext(input: WrappedSeasonInput): SeasonContext {
  const tournaments = seasonTournaments(input);
  const tournamentsById = new Map(tournaments.map((t) => [t.id, t]));
  const seasonRegs = input.registrations.filter((r) => tournamentsById.has(r.tournamentId));

  const regsByTournament = new Map<string, WrappedRegistration[]>();
  const regsByUid = new Map<string, WrappedRegistration[]>();
  for (const r of seasonRegs) {
    const list = regsByTournament.get(r.tournamentId) ?? [];
    list.push(r);
    regsByTournament.set(r.tournamentId, list);
    for (const uid of new Set(r.memberIds)) {
      const mine = regsByUid.get(uid) ?? [];
      if (!mine.some((x) => x.tournamentId === r.tournamentId)) mine.push(r);
      regsByUid.set(uid, mine);
    }
  }

  const signupMinutes = new Map<string, number[]>();
  for (const r of seasonRegs) {
    const start = tournamentsById.get(r.tournamentId)?.registrationStart;
    if (!r.ownerId || !r.registeredAt || !start) continue;
    const minutes = Math.max(0, (r.registeredAt.getTime() - start.getTime()) / 60000);
    const list = signupMinutes.get(r.ownerId) ?? [];
    list.push(minutes);
    signupMinutes.set(r.ownerId, list);
  }
  const signupMedians = new Map<string, number>();
  signupMinutes.forEach((list, uid) => {
    if (list.length >= MIN_SIGNUPS_FOR_SPEED) signupMedians.set(uid, median(list));
  });

  const eventCounts = new Map<string, number>();
  regsByUid.forEach((regs, uid) => eventCounts.set(uid, regs.length));

  // Money list covers every tournament dated in the year, like the Money List page.
  const yearTournaments = input.tournaments.filter(
    (t) => t.date.getUTCFullYear() === input.year,
  );
  const moneyList = computeMoneyList(yearTournaments, input.seasonAwards);

  return {
    tournaments,
    tournamentsById,
    seasonRegs,
    regsByTournament,
    regsByUid,
    moneyList,
    signupMedians,
    eventCounts,
    majors: buildMajors(input.championships, tournamentsById, regsByTournament),
  };
}

/** Members who get a story: paid for the year or played at least once. */
export function eligibleUsers(
  input: WrappedSeasonInput,
  ctx: SeasonContext,
): WrappedUser[] {
  return input.users.filter(
    (u) => u.isMigrated !== true && (input.paidUids.has(u.uid) || ctx.regsByUid.has(u.uid)),
  );
}

// ---------------------------------------------------------------------------
// Member half
// ---------------------------------------------------------------------------

function signupFor(uid: string, ctx: SeasonContext, myRegs: WrappedRegistration[]): SignupSpeed | undefined {
  const mine = ctx.signupMedians.get(uid);
  if (mine === undefined) return undefined;

  const others = Array.from(ctx.signupMedians.entries()).filter(([id]) => id !== uid);
  const slower = others.filter(([, m]) => m > mine).length;
  const fasterThanPercent = others.length > 0 ? Math.round((slower / others.length) * 100) : undefined;

  const firstOnSheet = myRegs
    .filter((r) => {
      if (!r.registeredAt) return false;
      const all = ctx.regsByTournament.get(r.tournamentId) ?? [];
      return all.every(
        (o) => o.id === r.id || !o.registeredAt || o.registeredAt.getTime() > r.registeredAt!.getTime(),
      );
    })
    .map((r) => {
      const t = ctx.tournamentsById.get(r.tournamentId)!;
      const minutes = t.registrationStart && r.registeredAt
        ? Math.max(0, Math.round((r.registeredAt.getTime() - t.registrationStart.getTime()) / 60000))
        : 0;
      return { tournamentTitle: t.title, minutesAfterOpen: minutes };
    });

  return {
    medianMinutes: Math.round(mine),
    ...(fasterThanPercent !== undefined && fasterThanPercent >= 50 ? { fasterThanPercent } : {}),
    firstOnSheet,
  };
}

function paidTogetherCount(uid: string, partner: string, ctx: SeasonContext): number {
  let count = 0;
  for (const t of ctx.tournaments) {
    const paid = t.winnerGroups.some((g) =>
      g.winners.some(
        (w) =>
          (w.prizeAmount ?? 0) > 0 &&
          w.competitors.some((c) => c.userId === uid) &&
          w.competitors.some((c) => c.userId === partner),
      ),
    );
    if (paid) count++;
  }
  return count;
}

function crewFor(uid: string, myRegs: WrappedRegistration[], ctx: SeasonContext) {
  const shared = new Map<string, { name: string; events: number }>();
  let goldTeeEvents = 0;
  for (const r of myRegs) {
    if (r.team.find((m) => m.id === uid)?.goldTee) goldTeeEvents++;
    for (const m of r.team) {
      if (m.id === uid) continue;
      const entry = shared.get(m.id) ?? { name: m.displayName, events: 0 };
      entry.events++;
      shared.set(m.id, entry);
    }
  }

  let topPartner: { uid: string; displayName: string; events: number; paidTogether: number } | undefined;
  for (const [partner, { name, events }] of shared) {
    if (events < MIN_SHARED_EVENTS_FOR_PARTNER) continue;
    const paidTogether = paidTogetherCount(uid, partner, ctx);
    const better =
      !topPartner ||
      events > topPartner.events ||
      (events === topPartner.events &&
        (paidTogether > topPartner.paidTogether ||
          (paidTogether === topPartner.paidTogether && byName(name, topPartner.displayName) < 0)));
    if (better) topPartner = { uid: partner, displayName: name, events, paidTogether };
  }

  return {
    ...(topPartner ? { topPartner } : {}),
    distinctTeammates: shared.size,
    goldTeeEvents,
  };
}

/** Every tournament (and season award) the member won money in, biggest first. */
export function paidEventsFor(row: MoneyListRow): PaidEvent[] {
  const byEvent = new Map<string, { title: string; amount: number; items: MoneyListItem[] }>();
  for (const item of row.items) {
    const entry = byEvent.get(item.tournamentId) ?? { title: item.title, amount: 0, items: [] };
    entry.amount += item.amount;
    entry.items.push(item);
    byEvent.set(item.tournamentId, entry);
  }
  return Array.from(byEvent.values())
    .map(({ title, amount, items }) => {
      const placed = items
        .filter((i) => i.source === "tournament" && i.groupType !== CLOSEST_TO_PIN && i.place > 0)
        .sort((a, b) => a.place - b.place)[0];
      const result = placed
        ? ordinal(placed.place)
        : items.some((i) => i.groupType === CLOSEST_TO_PIN)
          ? "CTP"
          : items[0].groupLabel;
      return { tournamentTitle: title, amount, result };
    })
    .sort((a, b) => b.amount - a.amount || byName(a.tournamentTitle, b.tournamentTitle));
}

function closestToPinFor(uid: string, ctx: SeasonContext, awards: readonly WrappedSeasonAward[]) {
  const holes: { hole: number; tournamentTitle: string }[] = [];
  for (const t of ctx.tournaments) {
    for (const g of t.winnerGroups) {
      if (g.type !== CLOSEST_TO_PIN) continue;
      for (const w of g.winners) {
        if (!w.competitors.some((c) => c.userId === uid)) continue;
        const hole = w.holeNumber ?? g.holeNumber;
        if (typeof hole === "number") holes.push({ hole, tournamentTitle: t.title });
      }
    }
  }
  const aces = awards
    .filter((a) => a.userId === uid && a.awardType === HOLE_IN_ONE)
    .map((a) => ({
      date: isoDate(a.date),
      ...(a.tournamentTitle ? { tournamentTitle: a.tournamentTitle } : {}),
    }));
  if (holes.length === 0 && aces.length === 0) return undefined;
  return { count: holes.length, holes, aces };
}

function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "SF";
  if (round === totalRounds - 2) return "QF";
  return `R${round}`;
}

function reachedLabel(round: number, totalRounds: number, wonFinal: boolean): string {
  if (wonFinal) return "Champions";
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinals";
  if (round === totalRounds - 2) return "Quarterfinals";
  return `Round ${round}`;
}

function teamLabel(team: WrappedBracket["teams"][number]): string {
  const names = team.memberNames?.filter(Boolean) ?? [];
  if (names.length === 0) return team.name;
  return names.map((n) => n.trim().split(/\s+/).at(-1) ?? n).join(" / ");
}

export function bracketRunFor(
  uid: string,
  brackets: readonly WrappedBracket[],
  ctx: SeasonContext,
): BracketRun | undefined {
  let best: BracketRun | undefined;
  for (const b of brackets) {
    const t = ctx.tournamentsById.get(b.tournamentId);
    const team = b.teams.find((x) => x.memberIds.includes(uid));
    if (!t || !team) continue;

    const totalRounds = Math.max(1, ...b.matches.map((m) => m.round));
    const teamsById = new Map(b.teams.map((x) => [x.id, x]));
    const mine = b.matches
      .filter((m) => (m.team1Id === team.id || m.team2Id === team.id) && m.winnerId)
      .sort((a, c) => a.round - c.round);

    const matches = mine.map((m) => {
      const opponentId = m.team1Id === team.id ? m.team2Id : m.team1Id;
      const opponent = opponentId ? teamsById.get(opponentId) : undefined;
      return {
        roundLabel: roundLabel(m.round, totalRounds),
        ...(opponent ? { opponent: teamLabel(opponent) } : {}),
        won: m.winnerId === team.id,
        bye: !opponentId,
      };
    });
    const played = matches.filter((m) => !m.bye);
    if (played.length === 0) continue;

    const last = mine[mine.length - 1];
    const wonFinal = last.round === totalRounds && last.winnerId === team.id;
    const run: BracketRun = {
      tournamentTitle: t.title,
      wins: played.filter((m) => m.won).length,
      losses: played.filter((m) => !m.won).length,
      byes: matches.length - played.length,
      reached: reachedLabel(last.round, totalRounds, wonFinal),
      matches,
    };
    if (!best || run.wins + run.losses > best.wins + best.losses) best = run;
  }
  return best;
}

function majorResultsFor(
  uid: string,
  majors: readonly MajorCard[],
  championships: readonly WrappedChampionship[],
  ctx: SeasonContext,
): Record<string, string> {
  const results: Record<string, string> = {};
  for (const major of majors) {
    if (major.kind === MAJOR_KIND.CLUB_CHAMPIONSHIP) {
      const lines = (major.flights ?? []).flatMap((f) => {
        const flight = f.label.replace(/ Champion$/, "");
        if (f.winnerIds.includes(uid)) return [`Champion, ${flight}`];
        if (f.runnerUpIds.includes(uid)) return [`Runner-up, ${flight}`];
        return [];
      });
      if (lines.length > 0) results[major.key] = lines.join(" · ");
      continue;
    }

    const champ = championships.find((c) => major.key === `${c.championshipType}:${c.id}`);
    if (champ?.winnerIds?.includes(uid)) {
      results[major.key] = "Champion";
      continue;
    }
    if (champ?.runnerUpIds?.includes(uid)) {
      results[major.key] = "Runner-up";
      continue;
    }
    if (!major.tournamentId) continue;
    const t = ctx.tournamentsById.get(major.tournamentId);
    const overall = t?.winnerGroups.find((g) => g.type === "overall");
    const place = overall?.winners.find((w) => w.competitors.some((c) => c.userId === uid));
    if (place) {
      const prize = place.prizeAmount ? ` · $${place.prizeAmount}` : "";
      results[major.key] = `${ordinal(place.place)}${prize}`;
    } else if ((ctx.regsByTournament.get(major.tournamentId) ?? []).some((r) => r.memberIds.includes(uid))) {
      results[major.key] = "In the field";
    }
  }
  return results;
}

export function computeMemberStory(
  user: WrappedUser,
  input: WrappedSeasonInput,
  ctx: SeasonContext,
  meta: { version: number; generatedAt: string },
): SeasonWrappedMember {
  const uid = user.uid;
  const myRegs = ctx.regsByUid.get(uid) ?? [];
  const played = myRegs.length > 0;

  let events: SeasonWrappedMember["events"];
  if (played) {
    const playedIds = new Set(myRegs.map((r) => r.tournamentId));
    const monthMap = new Map<number, { total: number; played: number }>();
    for (const t of ctx.tournaments) {
      const m = t.date.getUTCMonth();
      const tally = monthMap.get(m) ?? { total: 0, played: 0 };
      tally.total++;
      if (playedIds.has(t.id)) tally.played++;
      monthMap.set(m, tally);
    }
    const months = Array.from(monthMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([month, tally]) => ({ month, ...tally }));
    const playedMoreCount = Array.from(ctx.eventCounts.values()).filter((n) => n > myRegs.length).length;
    const enough = myRegs.length >= MIN_EVENTS_FOR_MONTHS;
    const busiest = enough
      ? months.reduce((a, b) => (b.played > a.played ? b : a)).month
      : undefined;
    events = {
      played: myRegs.length,
      calendar: ctx.tournaments.length,
      months,
      ...(busiest !== undefined ? { busiestMonth: busiest } : {}),
      ...(enough && inTopHalf(playedMoreCount + 1, ctx.eventCounts.size) ? { playedMoreCount } : {}),
    };
  }

  const moneyRow = ctx.moneyList.find((row) => row.uid === uid);
  const money = moneyRow && moneyRow.total > 0
    ? {
        total: moneyRow.total,
        ...(inTopHalf(moneyRow.rank, ctx.moneyList.length)
          ? { rank: moneyRow.rank, rankLabel: moneyRow.rankLabel }
          : {}),
        rankedMembers: ctx.moneyList.length,
        paidEvents: paidEventsFor(moneyRow),
      }
    : undefined;

  const signup = signupFor(uid, ctx, myRegs);
  const crew = played ? crewFor(uid, myRegs, ctx) : undefined;
  const closestToPin = closestToPinFor(uid, ctx, input.seasonAwards);
  const bracket = bracketRunFor(uid, input.brackets, ctx);
  const championshipsWon = input.championships
    .filter((c) => c.winnerIds?.includes(uid))
    .map((c) => CHAMPIONSHIP_LABELS[c.championshipType] ?? c.championshipType);

  return {
    uid,
    year: input.year,
    firstName: firstNameOf(user),
    displayName: user.displayName?.trim() || firstNameOf(user),
    version: meta.version,
    generatedAt: meta.generatedAt,
    played,
    ...(events ? { events } : {}),
    ...(signup ? { signup } : {}),
    ...(crew ? { crew } : {}),
    ...(money ? { money } : {}),
    ...(closestToPin ? { closestToPin } : {}),
    ...(bracket ? { bracket } : {}),
    championshipsWon,
    majorResults: majorResultsFor(uid, ctx.majors, input.championships, ctx),
    share: {
      events: myRegs.length,
      total: money?.total ?? 0,
      ...(money?.rankLabel ? { rankLabel: money.rankLabel } : {}),
      closestToPins: closestToPin?.count ?? 0,
      ...(crew?.topPartner ? { topPartner: crew.topPartner.displayName } : {}),
    },
    shareImagePath: seasonWrappedShareImagePath(input.year, uid),
  };
}
