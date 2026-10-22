import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  type NotificationType,
  type UserPrefsData,
  userWantsType,
} from "./notificationPreferences";
import { collectRegisteredUserIds } from "./registrationRecipients";
import { logger } from "./logger";
import { RESEND_API_KEY } from "./resendConfig";
import { sendResendBatch } from "./resendBatch";
import { getEmailIssueAddresses } from "./emailIssues";
import {
  EMAIL_UNSUBSCRIBE_SECRET,
  buildUnsubscribeUrl,
  unsubscribeKey,
} from "./emailUnsubscribe";
import {
  buildRegistrationOpeningMemberEmail,
  type RegistrationOpeningAdminEmailParams,
  type RegistrationOpeningMemberRecipient,
  sendRegistrationOpeningAdminEmail,
  sendRegistrationOpeningMemberPreviewEmail,
} from "./sendRegistrationOpeningEmails";
import { withSentry } from "./sentry";
import { emailIssueDocId } from "./types";

const REGISTRATION_OPENING_TYPE: NotificationType = "registration_opening";
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_DAYS = 60;
const BATCH_SIZE = 499;
/**
 * Member emails still to send, keyed by tournament ID. Written before the
 * first send and trimmed to the failed recipients afterwards, so later runs
 * retry only those. Functions-only (the rules' default deny covers it).
 */
export const PENDING_MEMBER_EMAILS_COLLECTION = "registrationOpeningEmailRetries";
export const MAX_MEMBER_EMAIL_ATTEMPTS = 3;

interface TournamentNotificationData {
  title?: string;
  status?: string;
  date?: admin.firestore.Timestamp | Date | string;
  registrationStart?: admin.firestore.Timestamp | Date | string;
  registrationEnd?: admin.firestore.Timestamp | Date | string;
  registrationOpeningNotificationEnabled?: boolean;
  tee?: string;
  assignedTeeTimes?: boolean;
  maxTeams?: number;
  registrationOpeningNotificationSentAt?:
    | admin.firestore.Timestamp
    | Date
    | string;
}

interface PendingMemberRecipient extends RegistrationOpeningMemberRecipient {
  uid: string;
}

interface PendingMemberEmailsData {
  recipients?: PendingMemberRecipient[];
  attempts?: number;
}

interface AdminFlags {
  isAdmin?: boolean;
  admin?: boolean | string;
}

interface UserContactData {
  email?: string;
}

interface MemberUserData extends UserPrefsData, UserContactData {
  isMigrated?: boolean;
  firstName?: string;
  displayName?: string;
  membershipType?: string;
  lastPaidYear?: number;
  notificationPreferences?: UserPrefsData["notificationPreferences"] & {
    emailTournamentUpdates?: boolean;
  };
}

/** Admin kill switch on `config/membershipSettings` (Membership settings UI). */
export const AUTOMATED_MEMBER_EMAILS_FIELD = "automatedMemberEmailsEnabled";

export function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed
      : undefined;
  }
  return undefined;
}

export function shouldSendRegistrationOpeningNotification(
  tournament: TournamentNotificationData,
  now: Date,
): boolean {
  return (
    !toDate(tournament.registrationOpeningNotificationSentAt) &&
    isRegistrationOpenForNotification(tournament, now)
  );
}

/** Registration is open and the tournament still wants the announcement. */
function isRegistrationOpenForNotification(
  tournament: TournamentNotificationData,
  now: Date,
): boolean {
  const registrationStart = toDate(tournament.registrationStart);
  const registrationEnd = toDate(tournament.registrationEnd);

  if (!registrationStart || registrationStart.getTime() > now.getTime()) {
    return false;
  }

  if (registrationEnd && registrationEnd.getTime() <= now.getTime()) {
    return false;
  }

  if (tournament.registrationOpeningNotificationEnabled === false) {
    return false;
  }

  return tournament.status !== "Canceled" && tournament.status !== "Completed";
}

export function buildRegistrationOpeningNotificationId(
  tournamentId: string,
  uid: string,
): string {
  return `registration_opening_${tournamentId}_${uid}`;
}

/** Mirrors `isActiveFullMember` in src/utils/membership.ts. */
export function isActivePaidMember(
  data: MemberUserData | undefined,
  year: number,
): boolean {
  return data?.membershipType === "full" && (data.lastPaidYear ?? 0) >= year;
}

/** Opt-out semantics: only an explicit `false` blocks the email. */
export function wantsRegistrationOpeningEmail(
  data: MemberUserData | undefined,
): boolean {
  return data?.notificationPreferences?.emailTournamentUpdates !== false;
}

/** Season the tournament belongs to; dates are midnight UTC. */
export function resolveMembershipYear(
  tournament: TournamentNotificationData,
  now: Date,
): number {
  return (toDate(tournament.date) ?? now).getUTCFullYear();
}

/** Off by default so emails only go out once an admin turns them on. */
export async function areAutomatedMemberEmailsEnabled(
  db: admin.firestore.Firestore,
): Promise<boolean> {
  const snap = await db.doc("config/membershipSettings").get();
  return snap.data()?.[AUTOMATED_MEMBER_EMAILS_FIELD] === true;
}

function firstName(data: MemberUserData): string | undefined {
  const name = data.firstName?.trim() || data.displayName?.trim();
  return name ? name.split(/\s+/)[0] : undefined;
}

function isAdminFlags(value: AdminFlags | undefined): boolean {
  return (
    value?.isAdmin === true || value?.admin === true || value?.admin === "true"
  );
}

function formatTournamentDate(date: Date | undefined): string | undefined {
  if (!date) return undefined;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildTournamentUrl(tournamentId: string): string {
  return `https://ridgefieldgolfclub.org/tournaments/${tournamentId}`;
}

function buildEmailParams(
  tournamentId: string,
  tournament: TournamentNotificationData,
): RegistrationOpeningAdminEmailParams {
  return {
    tournamentTitle: tournament.title?.trim() || "Tournament",
    tournamentUrl: buildTournamentUrl(tournamentId),
    tournamentDate: formatTournamentDate(toDate(tournament.date)),
    registrationCloses: formatTournamentDate(
      toDate(tournament.registrationEnd),
    ),
    tournamentTee: tournament.tee?.trim() || "Mixed",
    tournamentTeeTimes: tournament.assignedTeeTimes
      ? "Assigned"
      : "Get your own",
    fieldSize:
      typeof tournament.maxTeams === "number" && tournament.maxTeams > 0
        ? `${tournament.maxTeams} teams`
        : undefined,
  };
}

export async function getAdminEmails(
  db: admin.firestore.Firestore,
): Promise<string[]> {
  const adminSnap = await db.collection("admin").get();
  const adminIds = adminSnap.docs
    .filter((doc) => isAdminFlags(doc.data() as AdminFlags))
    .map((doc) => doc.id);

  const seen = new Set<string>();
  const emails: string[] = [];

  for (const uid of adminIds) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const email = (
      userSnap.data() as UserContactData | undefined
    )?.email?.trim();
    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);
    emails.push(email);
  }

  return emails;
}

interface RegistrationOpeningPreviewEmailOptions {
  db: admin.firestore.Firestore;
  apiKey: string;
  recipientUid: string;
  tournamentId: string;
  tournament: TournamentNotificationData;
}

export async function sendRegistrationOpeningPreviewEmail({
  db,
  apiKey,
  recipientUid,
  tournamentId,
  tournament,
}: RegistrationOpeningPreviewEmailOptions): Promise<{
  success: true;
  email: string;
}> {
  const userSnap = await db.doc(`users/${recipientUid}`).get();
  const userData = userSnap.data() as MemberUserData | undefined;
  const email = userData?.email?.trim();

  if (!email) {
    throw new HttpsError(
      "failed-precondition",
      "Your account email is not available for sending the preview.",
    );
  }

  // Same email members get, so admins preview exactly what goes out.
  await sendRegistrationOpeningMemberPreviewEmail(
    apiKey,
    {
      email,
      firstName: userData ? firstName(userData) : undefined,
      unsubscribeUrl: buildUnsubscribeUrl(
        unsubscribeKey(),
        recipientUid,
        "tournament_updates",
      ),
    },
    tournamentId,
    buildEmailParams(tournamentId, tournament),
  );

  return { success: true, email };
}

async function sendRegistrationOpeningAdminAnnouncement(
  db: admin.firestore.Firestore,
  apiKey: string,
  tournamentId: string,
  tournament: TournamentNotificationData,
  alreadyEmailed: ReadonlySet<string>,
): Promise<number> {
  const recipients = (await getAdminEmails(db)).filter(
    (email) => !alreadyEmailed.has(email.toLowerCase()),
  );
  if (recipients.length === 0) {
    logger.warn(
      "notify_registration_opening: no admin email recipients found",
      {
        tournamentId,
      },
    );
    return 0;
  }

  await sendRegistrationOpeningAdminEmail(apiKey, recipients, buildEmailParams(tournamentId, tournament));

  return recipients.length;
}

function resolveExpiresAt(registrationEnd: Date | undefined, now: Date): Date {
  if (registrationEnd && registrationEnd.getTime() > now.getTime()) {
    return registrationEnd;
  }

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);
  return expiresAt;
}

async function sendRegistrationOpeningBroadcast(
  db: admin.firestore.Firestore,
  tournamentId: string,
  tournamentTitle: string,
  registrationEnd: Date | undefined,
  registeredUserIds: ReadonlySet<string>,
  membershipYear: number,
  undeliverable: ReadonlySet<string>,
): Promise<{
  count: number;
  emailRecipients: PendingMemberRecipient[];
}> {
  const now = new Date();
  const emailRecipients: PendingMemberRecipient[] = [];
  const seenEmails = new Set<string>();
  const expiresAt = resolveExpiresAt(registrationEnd, now);
  const link = `/tournaments/${tournamentId}`;
  const title = `Registration Open — ${tournamentTitle}`;
  const body = `Registration for ${tournamentTitle} is now open! Secure your spot before it fills up.`;

  let count = 0;
  let batch = db.batch();
  const userStream = db
    .collection("users")
    .stream() as unknown as AsyncIterable<admin.firestore.QueryDocumentSnapshot>;

  for await (const userDoc of userStream) {
    if (registeredUserIds.has(userDoc.id)) {
      continue;
    }

    const data = userDoc.data() as MemberUserData;
    if (data.isMigrated === true) continue;

    // Email goes only to current paid members who allow tournament emails.
    const email = data.email?.trim();
    if (
      email &&
      !seenEmails.has(email.toLowerCase()) &&
      // Bounced or spam-flagged addresses (recorded by resend_webhook).
      !undeliverable.has(emailIssueDocId(email)) &&
      isActivePaidMember(data, membershipYear) &&
      wantsRegistrationOpeningEmail(data)
    ) {
      seenEmails.add(email.toLowerCase());
      emailRecipients.push({
        uid: userDoc.id,
        email,
        firstName: firstName(data),
      });
    }

    if (
      !userWantsType(data.notificationPreferences, REGISTRATION_OPENING_TYPE)
    ) {
      continue;
    }

    const notificationId = buildRegistrationOpeningNotificationId(
      tournamentId,
      userDoc.id,
    );
    const notificationRef = db.collection("notifications").doc(notificationId);

    batch.set(notificationRef, {
      uid: userDoc.id,
      title,
      body,
      type: REGISTRATION_OPENING_TYPE,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      data: {
        tournamentId,
        link,
      },
    });

    count++;
    if (count % BATCH_SIZE === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % BATCH_SIZE !== 0) {
    await batch.commit();
  }

  return { count, emailRecipients };
}

/**
 * Emails `recipients` and records the ones that failed in
 * `registrationOpeningEmailRetries/{tournamentId}` for the next run. The doc
 * is written before sending, so a timeout mid-send leaves every recipient
 * pending; the retry rebuilds the same chunks, and Resend's idempotency keys
 * stop the chunks that already went out from being delivered twice.
 */
async function sendRegistrationOpeningMemberEmails(
  db: admin.firestore.Firestore,
  apiKey: string,
  tournamentId: string,
  tournament: TournamentNotificationData,
  recipients: PendingMemberRecipient[],
  attempt: number,
): Promise<{ sent: number; failedRecipients: PendingMemberRecipient[] }> {
  const pendingRef = db
    .collection(PENDING_MEMBER_EMAILS_COLLECTION)
    .doc(tournamentId);
  if (recipients.length === 0) {
    await pendingRef.delete();
    return { sent: 0, failedRecipients: [] };
  }

  await pendingRef.set({
    recipients,
    attempts: attempt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const params = buildEmailParams(tournamentId, tournament);
  const key = unsubscribeKey();
  let sent = 0;
  let failedRecipients: PendingMemberRecipient[];
  try {
    const result = await sendResendBatch(
      apiKey,
      recipients.map(({ uid, email, firstName: name }) =>
        buildRegistrationOpeningMemberEmail(
          {
            email,
            firstName: name,
            unsubscribeUrl: buildUnsubscribeUrl(key, uid, "tournament_updates"),
          },
          tournamentId,
          params,
        ),
      ),
      { idempotencyPrefix: `registration-opening/${tournamentId}` },
    );
    sent = result.sent;
    failedRecipients = result.failedIndices.map((i) => recipients[i]);
  } catch (error) {
    failedRecipients = recipients;
    logger.error("notify_registration_opening: member emails failed", {
      tournamentId,
      attempt,
      error,
    });
  }

  if (failedRecipients.length === 0) {
    await pendingRef.delete();
  } else if (attempt >= MAX_MEMBER_EMAIL_ATTEMPTS) {
    await pendingRef.delete();
    logger.error("notify_registration_opening: giving up on member emails", {
      tournamentId,
      attempt,
      memberEmailFailed: failedRecipients.length,
    });
  } else {
    await pendingRef.set({
      recipients: failedRecipients,
      attempts: attempt,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (sent > 0) {
      logger.error("notify_registration_opening: some member emails failed", {
        tournamentId,
        attempt,
        memberEmailSent: sent,
        memberEmailFailed: failedRecipients.length,
      });
    }
  }

  return { sent, failedRecipients };
}

/** Retries member emails that failed on earlier runs. Returns emails sent. */
async function retryPendingMemberEmails(
  db: admin.firestore.Firestore,
  apiKey: string | undefined,
  memberEmailsEnabled: boolean,
  undeliverable: ReadonlySet<string>,
  pendingDocs: admin.firestore.QueryDocumentSnapshot[],
  now: Date,
): Promise<number> {
  let sent = 0;
  for (const pendingDoc of pendingDocs) {
    const tournamentId = pendingDoc.id;
    try {
      const pending = pendingDoc.data() as PendingMemberEmailsData;
      const tournament = (
        await db.doc(`tournaments/${tournamentId}`).get()
      ).data() as TournamentNotificationData | undefined;

      if (
        !apiKey ||
        !memberEmailsEnabled ||
        !tournament ||
        !isRegistrationOpenForNotification(tournament, now)
      ) {
        await pendingDoc.ref.delete();
        logger.warn("notify_registration_opening: dropped pending member emails", {
          tournamentId,
          memberEmailsEnabled,
        });
        continue;
      }

      const registeredUserIds = collectRegisteredUserIds(
        (await db.collection(`tournaments/${tournamentId}/registrations`).get())
          .docs,
      );
      const recipients = (pending.recipients ?? []).filter(
        (r) =>
          !registeredUserIds.has(r.uid) &&
          !undeliverable.has(emailIssueDocId(r.email)),
      );

      const result = await sendRegistrationOpeningMemberEmails(
        db,
        apiKey,
        tournamentId,
        tournament,
        recipients,
        (pending.attempts ?? 1) + 1,
      );
      sent += result.sent;
      logger.info("notify_registration_opening: member email retry", {
        tournamentId,
        memberEmailSent: result.sent,
        memberEmailFailed: result.failedRecipients.length,
      });
    } catch (error) {
      logger.error("notify_registration_opening: member email retry failed", {
        tournamentId,
        error,
      });
    }
  }
  return sent;
}

export const send_registration_opening_preview_email = onCall(
  { secrets: [RESEND_API_KEY, EMAIL_UNSUBSCRIBE_SECRET] },
  withSentry(
    "send_registration_opening_preview_email",
    async (request: CallableRequest) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be signed in.");
      }

      const callerUid = request.auth.uid;
      const tournamentId = String(request.data?.tournamentId ?? "").trim();
      if (!tournamentId) {
        throw new HttpsError("invalid-argument", "tournamentId is required.");
      }

      const adminDoc = await admin.firestore().doc(`admin/${callerUid}`).get();
      const isDocAdmin =
        adminDoc.exists &&
        isAdminFlags(adminDoc.data() as AdminFlags | undefined);

      if (!isDocAdmin) {
        throw new HttpsError("permission-denied", "Admin access required.");
      }

      const db = admin.firestore();
      const tournamentDoc = await db.doc(`tournaments/${tournamentId}`).get();
      if (!tournamentDoc.exists) {
        throw new HttpsError("not-found", "Tournament not found.");
      }

      const tournamentData = tournamentDoc.data() as TournamentNotificationData;
      const apiKey = RESEND_API_KEY.value();
      if (!apiKey) {
        throw new HttpsError("internal", "Resend is not configured.");
      }

      const result = await sendRegistrationOpeningPreviewEmail({
        db,
        apiKey,
        recipientUid: callerUid,
        tournamentId,
        tournament: tournamentData,
      });

      return {
        success: true,
        recipientEmail: result.email,
      };
    },
  ),
);

export const notify_registration_opening = onSchedule(
  {
    schedule: "0 09,21 * * *",
    timeZone: "America/New_York",
    // Room for Resend rate-limit retries when emailing the membership.
    timeoutSeconds: 300,
    secrets: [RESEND_API_KEY, EMAIL_UNSUBSCRIBE_SECRET],
  },
  withSentry("notify_registration_opening", async () => {
    const db = admin.firestore();
    const resendApiKey = RESEND_API_KEY.value();
    const now = new Date();
    const lookbackStart = new Date(now.getTime() - LOOKBACK_MS);

    const tournamentsSnap = await db
      .collection("tournaments")
      .where("registrationStart", ">=", lookbackStart)
      .where("registrationStart", "<=", now)
      .orderBy("registrationStart", "asc")
      .get();

    let tournamentCount = 0;
    let notificationCount = 0;
    let adminEmailCount = 0;
    let memberEmailCount = 0;

    const pendingSnap = await db
      .collection(PENDING_MEMBER_EMAILS_COLLECTION)
      .get();
    const memberEmailsEnabled =
      (tournamentsSnap.docs.length > 0 || pendingSnap.docs.length > 0) &&
      (await areAutomatedMemberEmailsEnabled(db));
    const undeliverable = memberEmailsEnabled
      ? await getEmailIssueAddresses(db)
      : new Set<string>();

    memberEmailCount += await retryPendingMemberEmails(
      db,
      resendApiKey,
      memberEmailsEnabled,
      undeliverable,
      pendingSnap.docs,
      now,
    );

    for (const tournamentDoc of tournamentsSnap.docs) {
      try {
        const data = tournamentDoc.data() as TournamentNotificationData;
        if (!shouldSendRegistrationOpeningNotification(data, now)) {
          continue;
        }

        // Claim the tournament before anything goes out, so a failure later
        // in this run can't make the next run email the membership again.
        // Failed member emails are retried from the pending collection.
        await tournamentDoc.ref.update({
          registrationOpeningNotificationSentAt: FieldValue.serverTimestamp(),
        });

        let sentCount: number;
        let emailRecipients: PendingMemberRecipient[];
        try {
          const registrationsSnap = await db
            .collection(`tournaments/${tournamentDoc.id}/registrations`)
            .get();
          ({ count: sentCount, emailRecipients } =
            await sendRegistrationOpeningBroadcast(
              db,
              tournamentDoc.id,
              data.title?.trim() || "Tournament",
              toDate(data.registrationEnd),
              collectRegisteredUserIds(registrationsSnap.docs),
              resolveMembershipYear(data, now),
              undeliverable,
            ));
        } catch (error) {
          // Nothing was emailed yet, so release the claim and retry it all
          // next run (in-app notification IDs are deterministic).
          await tournamentDoc.ref.update({
            registrationOpeningNotificationSentAt: FieldValue.delete(),
          });
          throw error;
        }

        let adminSentCount = 0;
        let memberSent = 0;
        let memberFailed = 0;
        const emailedAddresses = new Set<string>();
        if (resendApiKey && memberEmailsEnabled) {
          const result = await sendRegistrationOpeningMemberEmails(
            db,
            resendApiKey,
            tournamentDoc.id,
            data,
            emailRecipients,
            1,
          );
          memberSent = result.sent;
          memberFailed = result.failedRecipients.length;
          const failedAddresses = new Set(
            result.failedRecipients.map(({ email }) => email.toLowerCase()),
          );
          for (const { email } of emailRecipients) {
            const address = email.toLowerCase();
            if (!failedAddresses.has(address)) emailedAddresses.add(address);
          }
          memberEmailCount += memberSent;
        }

        if (resendApiKey) {
          try {
            adminSentCount = await sendRegistrationOpeningAdminAnnouncement(
              db,
              resendApiKey,
              tournamentDoc.id,
              data,
              emailedAddresses,
            );
            adminEmailCount += adminSentCount;
          } catch (error) {
            logger.error("notify_registration_opening: admin email failed", {
              tournamentId: tournamentDoc.id,
              error,
            });
          }
        } else {
          logger.warn(
            "notify_registration_opening: RESEND_API_KEY not configured",
            {
              tournamentId: tournamentDoc.id,
            },
          );
        }

        tournamentCount++;
        notificationCount += sentCount;

        logger.info("notify_registration_opening: tournament processed", {
          tournamentId: tournamentDoc.id,
          adminEmailCount: adminSentCount,
          recipientCount: sentCount,
          memberEmailsEnabled,
          memberEmailEligible: emailRecipients.length,
          memberEmailSent: memberSent,
          memberEmailFailed: memberFailed,
        });
      } catch (error) {
        logger.error("notify_registration_opening: tournament failed", {
          tournamentId: tournamentDoc.id,
          error,
        });
      }
    }

    logger.info("notify_registration_opening: run complete", {
      adminEmailCount,
      memberEmailCount,
      memberEmailsEnabled,
      tournamentCount,
      notificationCount,
    });
  }),
);
