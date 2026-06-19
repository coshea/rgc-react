import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  type NotificationType,
  type UserPrefsData,
  userWantsType,
} from "./notificationPreferences";
import { logger } from "./logger";

const REGISTRATION_OPENING_TYPE: NotificationType = "registration_opening";
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_DAYS = 60;
const BATCH_SIZE = 499;

interface TournamentNotificationData {
  title?: string;
  status?: string;
  registrationStart?: admin.firestore.Timestamp | Date | string;
  registrationEnd?: admin.firestore.Timestamp | Date | string;
  registrationOpeningNotificationEnabled?: boolean;
  registrationOpeningNotificationSentAt?:
    | admin.firestore.Timestamp
    | Date
    | string;
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

export const notify_registration_opening = onSchedule(
  {
    schedule: "0 09 * * *",
    timeZone: "America/New_York",
  },
  async () => {
    const db = admin.firestore();
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

    for (const tournamentDoc of tournamentsSnap.docs) {
      try {
        const data = tournamentDoc.data() as TournamentNotificationData;
        if (!shouldSendRegistrationOpeningNotification(data, now)) {
          continue;
        }

        const sentCount = await sendRegistrationOpeningBroadcast(
          db,
          tournamentDoc.id,
          data.title?.trim() || "Tournament",
          toDate(data.registrationEnd),
        );

        await tournamentDoc.ref.update({
          registrationOpeningNotificationSentAt: FieldValue.serverTimestamp(),
        });

        tournamentCount++;
        notificationCount += sentCount;

        logger.info("notify_registration_opening: tournament processed", {
          tournamentId: tournamentDoc.id,
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
      tournamentCount,
      notificationCount,
    });
  },
);
