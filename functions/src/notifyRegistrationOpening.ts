import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  type NotificationType,
  type UserPrefsData,
  userWantsType,
} from "./notificationPreferences";
import { collectRegisteredUserIds } from "./registrationRecipients";
import { logger } from "./logger";
import { RESEND_API_KEY } from "./resendConfig";
import { sendRegistrationOpeningAdminEmail } from "./sendRegistrationOpeningEmails";

const REGISTRATION_OPENING_TYPE: NotificationType = "registration_opening";
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_DAYS = 60;
const BATCH_SIZE = 499;

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

interface AdminFlags {
  isAdmin?: boolean;
  admin?: boolean | string;
}

interface UserContactData {
  email?: string;
}

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

  if (toDate(tournament.registrationOpeningNotificationSentAt)) {
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
  const email = (userSnap.data() as UserContactData | undefined)?.email?.trim();

  if (!email) {
    throw new HttpsError(
      "failed-precondition",
      "Your account email is not available for sending the preview.",
    );
  }

  await sendRegistrationOpeningAdminEmail(apiKey, [email], {
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
  });

  return { success: true, email };
}

async function sendRegistrationOpeningAdminAnnouncement(
  db: admin.firestore.Firestore,
  apiKey: string,
  tournamentId: string,
  tournament: TournamentNotificationData,
): Promise<number> {
  const recipients = await getAdminEmails(db);
  if (recipients.length === 0) {
    logger.warn(
      "notify_registration_opening: no admin email recipients found",
      {
        tournamentId,
      },
    );
    return 0;
  }

  await sendRegistrationOpeningAdminEmail(apiKey, recipients, {
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
  });

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
): Promise<number> {
  const now = new Date();
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

    const data = userDoc.data() as UserPrefsData & { isMigrated?: boolean };
    if (data.isMigrated === true) continue;
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

  return count;
}

export const send_registration_opening_preview_email = onCall(
  { secrets: [RESEND_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const callerUid = request.auth.uid;
    const tournamentId = String(request.data?.tournamentId ?? "").trim();
    if (!tournamentId) {
      throw new HttpsError("invalid-argument", "tournamentId is required.");
    }

    const isClaimAdmin = request.auth.token.admin === true;
    let isDocAdmin = false;
    if (!isClaimAdmin) {
      const adminDoc = await admin.firestore().doc(`admin/${callerUid}`).get();
      if (adminDoc.exists) {
        const data = adminDoc.data() as AdminFlags | undefined;
        isDocAdmin =
          data?.isAdmin === true ||
          data?.admin === true ||
          data?.admin === "true";
      }
    }

    if (!isClaimAdmin && !isDocAdmin) {
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
);

export const notify_registration_opening = onSchedule(
  {
    schedule: "0 09,21 * * *",
    timeZone: "America/New_York",
    secrets: [RESEND_API_KEY],
  },
  async () => {
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

    for (const tournamentDoc of tournamentsSnap.docs) {
      try {
        const data = tournamentDoc.data() as TournamentNotificationData;
        if (!shouldSendRegistrationOpeningNotification(data, now)) {
          continue;
        }

        const registrationsSnap = await db
          .collection(`tournaments/${tournamentDoc.id}/registrations`)
          .get();
        const registeredUserIds = collectRegisteredUserIds(
          registrationsSnap.docs,
        );

        const sentCount = await sendRegistrationOpeningBroadcast(
          db,
          tournamentDoc.id,
          data.title?.trim() || "Tournament",
          toDate(data.registrationEnd),
          registeredUserIds,
        );

        let adminSentCount = 0;
        if (resendApiKey) {
          adminSentCount = await sendRegistrationOpeningAdminAnnouncement(
            db,
            resendApiKey,
            tournamentDoc.id,
            data,
          );
          adminEmailCount += adminSentCount;
        } else {
          logger.warn(
            "notify_registration_opening: RESEND_API_KEY not configured",
            {
              tournamentId: tournamentDoc.id,
            },
          );
        }

        await tournamentDoc.ref.update({
          registrationOpeningNotificationSentAt: FieldValue.serverTimestamp(),
        });

        tournamentCount++;
        notificationCount += sentCount;

        logger.info("notify_registration_opening: tournament processed", {
          tournamentId: tournamentDoc.id,
          adminEmailCount: adminSentCount,
          recipientCount: sentCount,
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
      tournamentCount,
      notificationCount,
    });
  },
);
