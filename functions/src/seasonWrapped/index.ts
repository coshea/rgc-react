import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";

import { getEmailIssueAddresses } from "../emailIssues";
import { logger } from "../logger";
import {
  areAutomatedMemberEmailsEnabled,
  toDate,
} from "../notifyRegistrationOpening";
import { sendResendBatch } from "../resendBatch";
import { RESEND_API_KEY } from "../resendConfig";
import { buildSeasonWrappedEmail } from "./email";
import { renderShareImage } from "./shareImage";
import {
  buildSeasonContext,
  computeClubStats,
  computeMemberStory,
  eligibleUsers,
  type WrappedBracket,
  type WrappedChampionship,
  type WrappedRegistration,
  type WrappedSeasonAward,
  type WrappedSeasonInput,
  type WrappedTournament,
  type WrappedUser,
  type WrappedWinnerGroup,
} from "./stats";
import {
  SEASON_WRAPPED_CHANNEL,
  SEASON_WRAPPED_COLLECTION,
  SEASON_WRAPPED_DELIVERY,
  SEASON_WRAPPED_EMAIL_CATEGORY,
  SEASON_WRAPPED_MEMBERS,
  SEASON_WRAPPED_SOURCE,
  SEASON_WRAPPED_STATUS,
  seasonWrappedNotificationId,
  seasonWrappedPath,
  type ChannelSendCounts,
  type ClubSeasonStats,
  type GenerateSeasonWrappedResponse,
  type GetShareImageResponse,
  type SeasonWrappedChannel,
  type SeasonWrappedDelivery,
  type SeasonWrappedMember,
  type SeasonWrappedSeason,
  type SendSeasonWrappedResponse,
} from "./types";
import { withSentry } from "../sentry";
import { emailIssueDocId } from "../types";

const SEASON_WRAPPED_TYPE = "season_wrapped";
const NOTIFICATION_TTL_DAYS = 60;
const TEST_NOTIFICATION_TTL_DAYS = 1;
const WRITE_BATCH_SIZE = 400;
const EMAIL_CHUNK_SIZE = 100;
const IMAGE_CONCURRENCY = 4;
const MAX_SELECTED_UIDS = 500;

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

type Data = Record<string, unknown>;

function asData(value: unknown): Data {
  return value && typeof value === "object" ? (value as Data) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: unknown): string[] {
  return list(value).filter((v): v is string => typeof v === "string" && v !== "");
}

async function isAdminUid(uid: string): Promise<boolean> {
  const snap = await admin.firestore().doc(`admin/${uid}`).get();
  const d = snap.data();
  return d?.isAdmin === true || d?.admin === true || d?.admin === "true";
}

async function requireAdmin(request: CallableRequest): Promise<string> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  if (!(await isAdminUid(request.auth.uid))) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return request.auth.uid;
}

export function parseYear(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new HttpsError("invalid-argument", "year must be a four-digit year.");
  }
  return value;
}

function parseUids(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const uids = strings(value);
  if (uids.length === 0 || uids.length > MAX_SELECTED_UIDS) {
    throw new HttpsError(
      "invalid-argument",
      `uids must list 1 to ${MAX_SELECTED_UIDS} members.`,
    );
  }
  return Array.from(new Set(uids));
}

export function parseChannels(value: unknown): SeasonWrappedChannel[] {
  const valid = Object.values(SEASON_WRAPPED_CHANNEL) as string[];
  const channels = strings(value).filter((c): c is SeasonWrappedChannel => valid.includes(c));
  if (channels.length === 0) {
    throw new HttpsError("invalid-argument", "Choose at least one channel.");
  }
  return Array.from(new Set(channels));
}

function seasonRef(year: number) {
  return admin.firestore().collection(SEASON_WRAPPED_COLLECTION).doc(String(year));
}

// ---------------------------------------------------------------------------
// Loading the season from Firestore
// ---------------------------------------------------------------------------

function toWinnerGroups(value: unknown): WrappedWinnerGroup[] {
  return list(value).map((raw) => {
    const g = asData(raw);
    return {
      id: str(g.id) ?? "",
      label: str(g.label) ?? "",
      type: str(g.type) ?? "custom",
      ...(num(g.holeNumber) !== undefined ? { holeNumber: num(g.holeNumber) } : {}),
      winners: list(g.winners).map((rawPlace) => {
        const w = asData(rawPlace);
        return {
          place: num(w.place) ?? 0,
          competitors: list(w.competitors).flatMap((rawComp) => {
            const c = asData(rawComp);
            const userId = str(c.userId);
            return userId ? [{ userId, displayName: str(c.displayName) ?? userId }] : [];
          }),
          ...(num(w.prizeAmount) !== undefined ? { prizeAmount: num(w.prizeAmount) } : {}),
          ...(str(w.score) ? { score: str(w.score) } : {}),
          ...(num(w.holeNumber) !== undefined ? { holeNumber: num(w.holeNumber) } : {}),
        };
      }),
    };
  });
}

function toTournament(id: string, d: Data): WrappedTournament | null {
  const date = toDate(d.date);
  if (!date) return null;
  const weather = asData(d.weather);
  const temperature = num(weather.temperature);
  const windSpeed = num(weather.windSpeed);
  return {
    id,
    title: str(d.title) ?? "Tournament",
    date,
    ...(str(d.status) ? { status: str(d.status) } : {}),
    ...(temperature !== undefined && windSpeed !== undefined
      ? { weather: { temperature, windSpeed, precipitation: num(weather.precipitation) ?? 0 } }
      : {}),
    winnerGroups: toWinnerGroups(d.winnerGroups),
  };
}

function toRegistration(id: string, tournamentId: string, d: Data): WrappedRegistration {
  const team = list(d.team).flatMap((raw) => {
    const m = asData(raw);
    const memberId = str(m.id);
    return memberId
      ? [{ id: memberId, displayName: str(m.displayName) ?? memberId, goldTee: m.goldTee === true }]
      : [];
  });
  const memberIds = strings(d.memberIds);
  return {
    id,
    tournamentId,
    memberIds: memberIds.length > 0 ? memberIds : team.map((m) => m.id),
    team,
  };
}

function toBracket(tournamentId: string, d: Data): WrappedBracket {
  return {
    tournamentId,
    teams: list(d.teams).map((raw) => {
      const t = asData(raw);
      return {
        id: str(t.id) ?? "",
        name: str(t.name) ?? "",
        memberIds: strings(t.memberIds),
        memberNames: strings(t.memberNames),
      };
    }),
    matches: list(d.matches).map((raw) => {
      const m = asData(raw);
      return {
        id: str(m.id) ?? "",
        round: num(m.round) ?? 1,
        position: num(m.position) ?? 0,
        team1Id: str(m.team1Id) ?? null,
        team2Id: str(m.team2Id) ?? null,
        winnerId: str(m.winnerId) ?? null,
      };
    }),
  };
}

interface UserRecord extends WrappedUser {
  email?: string;
  wantsEmail: boolean;
  wantsApp: boolean;
}

function toUser(uid: string, d: Data): UserRecord {
  const prefs = asData(d.notificationPreferences);
  return {
    uid,
    ...(str(d.firstName) ? { firstName: str(d.firstName) } : {}),
    ...(str(d.displayName) ? { displayName: str(d.displayName) } : {}),
    isMigrated: d.isMigrated === true,
    ...(str(d.email) ? { email: str(d.email) } : {}),
    wantsEmail: prefs.emailGeneralAnnouncements !== false,
    wantsApp: prefs.generalAnnouncements !== false,
  };
}

async function loadSeasonInput(
  db: admin.firestore.Firestore,
  year: number,
  now: Date,
): Promise<WrappedSeasonInput & { userRecords: Map<string, UserRecord> }> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [tournamentSnap, awardSnap, champSnap, userSnap, paymentSnap] =
    await Promise.all([
      db.collection("tournaments").where("date", ">=", start).where("date", "<", end).get(),
      db.collection("seasonAwards").where("seasonYear", "==", year).get(),
      db.collection("championships").where("year", "==", year).get(),
      db
        .collection("users")
        .select("firstName", "displayName", "isMigrated", "email", "notificationPreferences")
        .get(),
      db
        .collection("memberPayments")
        .where("year", "==", year)
        .where("status", "==", "confirmed")
        .get(),
    ]);

  const tournaments = tournamentSnap.docs
    .map((doc) => toTournament(doc.id, doc.data()))
    .filter((t): t is WrappedTournament => t !== null);

  const regSnaps = await Promise.all(
    tournaments.map((t) => db.collection(`tournaments/${t.id}/registrations`).get()),
  );
  const registrations = regSnaps.flatMap((snap, i) =>
    snap.docs.map((doc) => toRegistration(doc.id, tournaments[i].id, doc.data())),
  );

  const bracketSnaps = tournaments.length
    ? await db.getAll(...tournaments.map((t) => db.doc(`brackets/${t.id}`)))
    : [];
  const brackets = bracketSnaps
    .filter((snap) => snap.exists)
    .map((snap) => toBracket(snap.id, snap.data() ?? {}));

  const seasonAwards: WrappedSeasonAward[] = awardSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const userId = str(d.userId);
    const date = toDate(d.date);
    if (!userId || !date) return [];
    return [
      {
        id: doc.id,
        userId,
        userDisplayName: str(d.userDisplayName) ?? userId,
        awardType: str(d.awardType) ?? "",
        amount: num(d.amount) ?? 0,
        date,
        ...(str(d.tournamentTitle) ? { tournamentTitle: str(d.tournamentTitle) } : {}),
        ...(num(d.holeNumber) !== undefined ? { holeNumber: num(d.holeNumber) } : {}),
      },
    ];
  });

  const championships: WrappedChampionship[] = champSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      championshipType: str(d.championshipType) ?? "other",
      winnerNames: strings(d.winnerNames),
      winnerIds: strings(d.winnerIds),
      runnerUpNames: strings(d.runnerUpNames),
      runnerUpIds: strings(d.runnerUpIds),
      ...(str(d.tournamentId) ? { tournamentId: str(d.tournamentId) } : {}),
    };
  });

  const userRecords = new Map(userSnap.docs.map((doc) => [doc.id, toUser(doc.id, doc.data())]));
  const paidUids = new Set(
    paymentSnap.docs
      .map((doc) => doc.data())
      .filter((d) => d.purpose !== "donation")
      .flatMap((d) => (str(d.userId) ? [str(d.userId)!] : [])),
  );

  return {
    year,
    now,
    tournaments,
    registrations,
    brackets,
    seasonAwards,
    championships,
    users: Array.from(userRecords.values()),
    paidUids,
    userRecords,
  };
}

// ---------------------------------------------------------------------------
// Share images
// ---------------------------------------------------------------------------

async function saveShareImage(member: SeasonWrappedMember): Promise<Buffer> {
  const png = await renderShareImage(member);
  await admin
    .storage()
    .bucket()
    .file(member.shareImagePath)
    .save(png, {
      contentType: "image/png",
      resumable: false,
      metadata: { cacheControl: "private, max-age=0" },
    });
  return png;
}

/** Runs `task` over `items`, `limit` at a time. Returns how many failed. */
async function runPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<number> {
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return failed;
}

async function commitInBatches(
  db: admin.firestore.Firestore,
  writes: ((batch: admin.firestore.WriteBatch) => void)[],
): Promise<void> {
  for (let i = 0; i < writes.length; i += WRITE_BATCH_SIZE) {
    const batch = db.batch();
    writes.slice(i, i + WRITE_BATCH_SIZE).forEach((write) => write(batch));
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// generate_season_wrapped
// ---------------------------------------------------------------------------

/**
 * Computes the club half and each member's story. Pass `uids` to generate
 * only those members (for testing); omit it to generate every eligible member
 * and remove stories for anyone no longer eligible. Never sends anything.
 * Each member doc is overwritten in place, so links already sent keep working.
 */
export const generate_season_wrapped = onCall(
  { timeoutSeconds: 540, memory: "1GiB" },
  withSentry("generate_season_wrapped", async (request: CallableRequest) => {
    const callerUid = await requireAdmin(request);
    const data = asData(request.data);
    const year = parseYear(data.year);
    const uids = parseUids(data.uids);

    const db = admin.firestore();
    const now = new Date();
    const generatedAt = now.toISOString();
    const input = await loadSeasonInput(db, year, now);
    const ctx = buildSeasonContext(input);
    const club = computeClubStats(input, ctx);
    const eligible = eligibleUsers(input, ctx);
    const targets = uids ? eligible.filter((u) => uids.includes(u.uid)) : eligible;

    const ref = seasonRef(year);
    const membersCol = ref.collection(SEASON_WRAPPED_MEMBERS);
    const existing = targets.length
      ? await db.getAll(...targets.map((u) => membersCol.doc(u.uid)))
      : [];
    const versions = new Map(
      existing.map((snap) => [snap.id, num(snap.data()?.version) ?? 0]),
    );

    const stories = targets.map((user) =>
      computeMemberStory(user, input, ctx, {
        version: (versions.get(user.uid) ?? 0) + 1,
        generatedAt,
      }),
    );
    await commitInBatches(
      db,
      stories.map((story) => (batch) => batch.set(membersCol.doc(story.uid), story)),
    );

    if (!uids) {
      const keep = new Set(targets.map((u) => u.uid));
      const all = await membersCol.select().get();
      const stale = all.docs.filter((doc) => !keep.has(doc.id));
      await commitInBatches(db, stale.map((doc) => (batch) => batch.delete(doc.ref)));
      if (stale.length > 0) {
        logger.info("generate_season_wrapped: removed stale stories", { year, removed: stale.length });
      }
    }

    const shareImagesFailed = await runPool(stories, IMAGE_CONCURRENCY, async (story) => {
      try {
        await saveShareImage(story);
      } catch (error) {
        logger.warn("generate_season_wrapped: share image failed", { year, uid: story.uid, error });
        throw error;
      }
    });

    const memberCount = (await membersCol.count().get()).data().count;
    const seasonSnap = await ref.get();
    if (seasonSnap.exists) {
      // update() replaces `club` whole, so stale nested fields can't linger.
      await ref.update({ club, memberCount, generatedAt, generatedBy: callerUid });
    } else {
      const season: SeasonWrappedSeason = {
        year,
        status: SEASON_WRAPPED_STATUS.DRAFT,
        club,
        memberCount,
        generatedAt,
        generatedBy: callerUid,
      };
      await ref.set(season);
    }

    logger.info("generate_season_wrapped: done", {
      year,
      callerUid,
      generated: stories.length,
      selected: uids?.length ?? null,
      shareImagesFailed,
    });

    const response: GenerateSeasonWrappedResponse = {
      ok: true,
      generated: stories.length,
      skipped: uids ? uids.length - targets.length : 0,
      shareImagesFailed,
    };
    return response;
  }),
);

// ---------------------------------------------------------------------------
// publish_season_wrapped
// ---------------------------------------------------------------------------

export const publish_season_wrapped = onCall(
  withSentry("publish_season_wrapped", async (request: CallableRequest) => {
    const callerUid = await requireAdmin(request);
    const data = asData(request.data);
    const year = parseYear(data.year);
    const published = data.published === true;

    const ref = seasonRef(year);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Generate Wrapped for this year first.");
    }

    await ref.update(
      published
        ? {
            status: SEASON_WRAPPED_STATUS.PUBLISHED,
            publishedAt: new Date().toISOString(),
            publishedBy: callerUid,
          }
        : {
            status: SEASON_WRAPPED_STATUS.DRAFT,
            publishedAt: FieldValue.delete(),
            publishedBy: FieldValue.delete(),
          },
    );
    logger.info("publish_season_wrapped", { year, callerUid, published });
    return { ok: true, published };
  }),
);

// ---------------------------------------------------------------------------
// send_season_wrapped_announcements
// ---------------------------------------------------------------------------

function emptyCounts(): ChannelSendCounts {
  return {
    eligible: 0,
    alreadySent: 0,
    optedOut: 0,
    undeliverable: 0,
    toSend: 0,
    sent: 0,
    failed: 0,
  };
}

interface EmailTarget {
  uid: string;
  email: string;
  story: SeasonWrappedMember;
}

async function sendEmailChunk(
  db: admin.firestore.Firestore,
  apiKey: string,
  year: number,
  club: ClubSeasonStats,
  chunk: EmailTarget[],
): Promise<{ sent: number; failed: number }> {
  const deliveryCol = seasonRef(year).collection(SEASON_WRAPPED_DELIVERY);
  const sentAt = new Date().toISOString();

  // Claim before sending: a timeout mid-send can't lead to a second email.
  const claim = db.batch();
  for (const t of chunk) {
    claim.set(deliveryCol.doc(t.uid), { uid: t.uid, emailSentAt: sentAt }, { merge: true });
  }
  await claim.commit();

  let failedIndices: number[];
  try {
    const result = await sendResendBatch(
      apiKey,
      chunk.map((t) => buildSeasonWrappedEmail(t.email, t.story, club)),
      { idempotencyPrefix: `season-wrapped/${year}` },
    );
    failedIndices = result.failedIndices;
  } catch (error) {
    failedIndices = chunk.map((_, i) => i);
    logger.error("send_season_wrapped_announcements: email chunk failed", {
      year,
      chunkSize: chunk.length,
      error,
    });
  }

  if (failedIndices.length > 0) {
    const release = db.batch();
    for (const i of failedIndices) {
      release.update(deliveryCol.doc(chunk[i].uid), { emailSentAt: FieldValue.delete() });
    }
    await release.commit();
  }
  return { sent: chunk.length - failedIndices.length, failed: failedIndices.length };
}

function appNotification(year: number, uid: string, test = false) {
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + (test ? TEST_NOTIFICATION_TTL_DAYS : NOTIFICATION_TTL_DAYS),
  );
  const link = test
    ? `${seasonWrappedPath(year)}?member=${encodeURIComponent(uid)}`
    : `${seasonWrappedPath(year)}?utm_source=${SEASON_WRAPPED_SOURCE.PUSH}`;
  return {
    title: `${test ? "[Test] " : ""}Your ${year} RGC season is ready`,
    body: "Tap to see your season: partners, best finishes, the majors and more.",
    type: SEASON_WRAPPED_TYPE,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    data: { link },
  };
}

/**
 * Sends the Wrapped announcement on the chosen channels to members who
 * haven't received that channel yet. `dryRun` returns the counts only.
 * Push rides on the in-app notification (dispatch_push_notification).
 */
export const send_season_wrapped_announcements = onCall(
  { timeoutSeconds: 540, secrets: [RESEND_API_KEY] },
  withSentry("send_season_wrapped_announcements", async (request: CallableRequest) => {
    const callerUid = await requireAdmin(request);
    const data = asData(request.data);
    const year = parseYear(data.year);
    const channels = parseChannels(data.channels);
    const dryRun = data.dryRun !== false;

    const db = admin.firestore();
    const ref = seasonRef(year);
    const seasonSnap = await ref.get();
    const season = seasonSnap.data() as SeasonWrappedSeason | undefined;
    if (!season) {
      throw new HttpsError("not-found", "Generate Wrapped for this year first.");
    }
    if (!dryRun && season.status !== SEASON_WRAPPED_STATUS.PUBLISHED) {
      throw new HttpsError("failed-precondition", "Publish Wrapped before sending announcements.");
    }

    const [memberSnap, deliverySnap] = await Promise.all([
      ref.collection(SEASON_WRAPPED_MEMBERS).get(),
      ref.collection(SEASON_WRAPPED_DELIVERY).get(),
    ]);
    const stories = memberSnap.docs.map((doc) => doc.data() as SeasonWrappedMember);
    const deliveries = new Map(
      deliverySnap.docs.map((doc) => [doc.id, doc.data() as SeasonWrappedDelivery]),
    );
    const userSnaps = stories.length
      ? await db.getAll(...stories.map((s) => db.doc(`users/${s.uid}`)))
      : [];
    const users = new Map(userSnaps.map((snap) => [snap.id, toUser(snap.id, snap.data() ?? {})]));

    const counts: SendSeasonWrappedResponse["counts"] = {};
    const emailTargets: EmailTarget[] = [];
    const appTargets: string[] = [];

    if (channels.includes(SEASON_WRAPPED_CHANNEL.EMAIL)) {
      const c = emptyCounts();
      const apiKey = RESEND_API_KEY.value();
      if (!apiKey) c.blocked = "Resend is not configured.";
      else if (!(await areAutomatedMemberEmailsEnabled(db))) {
        c.blocked = "Automated member emails are turned off in Membership settings.";
      }
      const undeliverable = await getEmailIssueAddresses(db);
      const seen = new Set<string>();
      for (const story of stories) {
        c.eligible++;
        const user = users.get(story.uid);
        const email = user?.email;
        if (deliveries.get(story.uid)?.emailSentAt) c.alreadySent++;
        else if (user && !user.wantsEmail) c.optedOut++;
        else if (!email || undeliverable.has(emailIssueDocId(email)) || seen.has(email.toLowerCase())) {
          // No address, bounced/complained, or a duplicate account sharing the address.
          c.undeliverable++;
        } else {
          seen.add(email.toLowerCase());
          emailTargets.push({ uid: story.uid, email, story });
        }
      }
      c.toSend = emailTargets.length;
      counts.email = c;
    }

    if (channels.includes(SEASON_WRAPPED_CHANNEL.APP)) {
      const c = emptyCounts();
      for (const story of stories) {
        c.eligible++;
        const user = users.get(story.uid);
        if (deliveries.get(story.uid)?.appSentAt) c.alreadySent++;
        else if (user && !user.wantsApp) c.optedOut++;
        else appTargets.push(story.uid);
      }
      c.toSend = appTargets.length;
      counts.app = c;
    }

    if (dryRun) {
      const response: SendSeasonWrappedResponse = { ok: true, dryRun: true, counts };
      return response;
    }

    const announcementLog: Record<string, unknown> = {};
    const nowIso = new Date().toISOString();

    if (counts.email && !counts.email.blocked && emailTargets.length > 0) {
      const apiKey = RESEND_API_KEY.value();
      for (let i = 0; i < emailTargets.length; i += EMAIL_CHUNK_SIZE) {
        const result = await sendEmailChunk(
          db,
          apiKey,
          year,
          season.club,
          emailTargets.slice(i, i + EMAIL_CHUNK_SIZE),
        );
        counts.email.sent += result.sent;
        counts.email.failed += result.failed;
      }
      announcementLog["announcements.email"] = {
        lastSentAt: nowIso,
        lastSentBy: callerUid,
        totalSent: (season.announcements?.email?.totalSent ?? 0) + counts.email.sent,
      };
    }

    if (counts.app && appTargets.length > 0) {
      const deliveryCol = ref.collection(SEASON_WRAPPED_DELIVERY);
      await commitInBatches(
        db,
        appTargets.map((uid) => (batch) => {
          // Deterministic id: a repeat can't create a second notification or push.
          batch.set(db.collection("notifications").doc(seasonWrappedNotificationId(year, uid)), {
            uid,
            ...appNotification(year, uid),
          });
          batch.set(deliveryCol.doc(uid), { uid, appSentAt: nowIso }, { merge: true });
        }),
      );
      counts.app.sent = appTargets.length;
      announcementLog["announcements.app"] = {
        lastSentAt: nowIso,
        lastSentBy: callerUid,
        totalSent: (season.announcements?.app?.totalSent ?? 0) + appTargets.length,
      };
    }

    if (Object.keys(announcementLog).length > 0) {
      await ref.update(announcementLog);
    }

    logger.info("send_season_wrapped_announcements: sent", {
      year,
      callerUid,
      emailSent: counts.email?.sent ?? 0,
      emailFailed: counts.email?.failed ?? 0,
      emailBlocked: counts.email?.blocked ?? null,
      appSent: counts.app?.sent ?? 0,
    });
    if ((counts.email?.failed ?? 0) > 0) {
      logger.error("send_season_wrapped_announcements: some emails failed", {
        year,
        emailFailed: counts.email?.failed,
      });
    }

    const response: SendSeasonWrappedResponse = { ok: true, dryRun: false, counts };
    return response;
  }),
);

// ---------------------------------------------------------------------------
// send_season_wrapped_test
// ---------------------------------------------------------------------------

/** Sends one member's email and an app notification to the calling admin only. */
export const send_season_wrapped_test = onCall(
  { secrets: [RESEND_API_KEY] },
  withSentry("send_season_wrapped_test", async (request: CallableRequest) => {
    const callerUid = await requireAdmin(request);
    const data = asData(request.data);
    const year = parseYear(data.year);
    const uid = str(data.uid) ?? callerUid;

    const db = admin.firestore();
    const ref = seasonRef(year);
    const [seasonSnap, memberSnap, callerSnap] = await Promise.all([
      ref.get(),
      ref.collection(SEASON_WRAPPED_MEMBERS).doc(uid).get(),
      db.doc(`users/${callerUid}`).get(),
    ]);
    const season = seasonSnap.data() as SeasonWrappedSeason | undefined;
    const story = memberSnap.data() as SeasonWrappedMember | undefined;
    if (!season || !story) {
      throw new HttpsError("not-found", "Generate this member's story first.");
    }
    const email = str(callerSnap.data()?.email);
    if (!email) {
      throw new HttpsError("failed-precondition", "Your account has no email address.");
    }
    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError("internal", "Resend is not configured.");
    }

    const message = buildSeasonWrappedEmail(email, story, season.club);
    // Single send without an idempotency key, so repeated tests all arrive.
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...message,
        subject: `[Test] ${message.subject}`,
        tags: message.tags?.map((tag) =>
          tag.name === "category" ? { ...tag, value: `${SEASON_WRAPPED_EMAIL_CATEGORY}_preview` } : tag,
        ),
      }),
    });
    if (!response.ok) {
      throw new HttpsError("internal", `Resend API error ${response.status}`);
    }

    await db.collection("notifications").add({ uid: callerUid, ...appNotification(year, uid, true) });

    logger.info("send_season_wrapped_test: sent", { year, callerUid, storyUid: uid });
    return { ok: true, email };
  }),
);

// ---------------------------------------------------------------------------
// get_season_wrapped_share_image
// ---------------------------------------------------------------------------

/**
 * Returns a member's share image as base64. Members get their own once the
 * season is published; admins can fetch anyone's at any time. Served through
 * a callable so the page needs no Storage CORS setup.
 */
export const get_season_wrapped_share_image = onCall(
  { memory: "512MiB" },
  withSentry("get_season_wrapped_share_image", async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const callerUid = request.auth.uid;
    const data = asData(request.data);
    const year = parseYear(data.year);
    const uid = str(data.uid) ?? callerUid;

    const isAdmin = await isAdminUid(callerUid);
    if (uid !== callerUid && !isAdmin) {
      throw new HttpsError("permission-denied", "You can only share your own season.");
    }

    const ref = seasonRef(year);
    const [seasonSnap, memberSnap] = await Promise.all([
      ref.get(),
      ref.collection(SEASON_WRAPPED_MEMBERS).doc(uid).get(),
    ]);
    const story = memberSnap.data() as SeasonWrappedMember | undefined;
    if (!story) {
      throw new HttpsError("not-found", "No story for this member.");
    }
    if (!isAdmin && seasonSnap.data()?.status !== SEASON_WRAPPED_STATUS.PUBLISHED) {
      throw new HttpsError("permission-denied", "Wrapped isn't published yet.");
    }

    let png: Buffer;
    try {
      [png] = await admin.storage().bucket().file(story.shareImagePath).download();
    } catch {
      // Missing (e.g. it failed during generate): render it now and keep it.
      png = await saveShareImage(story);
    }

    const response: GetShareImageResponse = {
      ok: true,
      image: png.toString("base64"),
      version: story.version,
    };
    return response;
  }),
);
