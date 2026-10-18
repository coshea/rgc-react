import { createHmac, timingSafeEqual } from "node:crypto";

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

import { logger } from "./logger";
import { RESEND_WEBHOOK_SECRET } from "./resendConfig";
import { withSentry } from "./sentry";
import {
  SEASON_WRAPPED_COLLECTION,
  SEASON_WRAPPED_DELIVERY,
  SEASON_WRAPPED_EMAIL_CATEGORY,
} from "./seasonWrapped/types";
import {
  EMAIL_ISSUE_STATUS,
  EMAIL_ISSUES_COLLECTION,
  type EmailIssue,
  type EmailIssueStatus,
  emailIssueDocId,
} from "./types";

/** Svix (Resend's webhook sender) rejects anything older than 5 minutes. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id?: string;
  timestamp?: string;
  signature?: string;
}

/**
 * Verifies a Resend webhook per Svix's scheme: HMAC-SHA256 over
 * `${id}.${timestamp}.${rawBody}` keyed with the base64 part of the
 * `whsec_` secret, compared against each `v1,<sig>` in the header.
 */
export function verifyResendSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
  nowSeconds: number,
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (
    !Number.isFinite(sentAt) ||
    Math.abs(nowSeconds - sentAt) > TIMESTAMP_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const candidate = Buffer.from(value, "base64");
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  });
}

interface ResendEmailEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    tags?: Record<string, string>;
    bounce?: { type?: string; subType?: string; message?: string };
    suppressed?: { type?: string; message?: string };
  };
}

/**
 * Maps a Resend event to the issue to record, or null to ignore it.
 * Only permanent bounces count; transient ones (full mailbox, greylisting)
 * usually resolve on their own.
 */
export function toEmailIssue(
  event: ResendEmailEvent,
): { status: EmailIssueStatus; reason?: string } | null {
  switch (event.type) {
    case "email.bounced":
      return event.data?.bounce?.type === "Permanent"
        ? {
            status: EMAIL_ISSUE_STATUS.BOUNCED,
            reason: event.data.bounce.message,
          }
        : null;
    case "email.complained":
      return {
        status: EMAIL_ISSUE_STATUS.COMPLAINED,
        reason: "Recipient marked the email as spam.",
      };
    case "email.suppressed":
      return {
        status: EMAIL_ISSUE_STATUS.SUPPRESSED,
        reason: event.data?.suppressed?.message,
      };
    default:
      return null;
  }
}

export async function recordEmailIssues(
  db: admin.firestore.Firestore,
  event: ResendEmailEvent,
): Promise<number> {
  const issue = toEmailIssue(event);
  const recipients = event.data?.to ?? [];
  if (!issue || recipients.length === 0) return 0;

  const batch = db.batch();
  for (const email of recipients) {
    const record: EmailIssue = {
      email: email.trim(),
      status: issue.status,
      occurredAt: event.created_at ?? new Date().toISOString(),
      ...(issue.reason ? { reason: issue.reason } : {}),
      ...(event.data?.email_id ? { emailId: event.data.email_id } : {}),
      ...(event.data?.tags?.category
        ? { category: event.data.tags.category }
        : {}),
    };
    batch.set(
      db.collection(EMAIL_ISSUES_COLLECTION).doc(emailIssueDocId(email)),
      { ...record, updatedAt: FieldValue.serverTimestamp() },
    );
  }
  await batch.commit();
  return recipients.length;
}

/**
 * Records a click on a Season Wrapped email against the member's delivery
 * record. Needs click tracking on the sending domain and `email.clicked` in
 * the webhook's events. Returns false for any other event.
 */
export async function recordSeasonWrappedClick(
  db: admin.firestore.Firestore,
  event: ResendEmailEvent,
): Promise<boolean> {
  const tags = event.data?.tags;
  const year = Number(tags?.year);
  const uid = tags?.uid;
  if (
    event.type !== "email.clicked" ||
    tags?.category !== SEASON_WRAPPED_EMAIL_CATEGORY ||
    !uid ||
    !Number.isInteger(year)
  ) {
    return false;
  }

  const ref = db
    .collection(SEASON_WRAPPED_COLLECTION)
    .doc(String(year))
    .collection(SEASON_WRAPPED_DELIVERY)
    .doc(uid);
  const clickedAt = event.created_at ?? new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    tx.set(
      ref,
      {
        uid,
        emailClicks: FieldValue.increment(1),
        lastEmailClickAt: clickedAt,
        ...(snap.data()?.firstEmailClickAt ? {} : { firstEmailClickAt: clickedAt }),
      },
      { merge: true },
    );
  });
  return true;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resend webhook endpoint. Subscribe it to email.bounced, email.complained,
 * email.suppressed and email.clicked in the Resend dashboard (Webhooks), and store the
 * signing secret with `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`.
 */
export const resend_webhook = onRequest(
  { secrets: [RESEND_WEBHOOK_SECRET] },
  withSentry("resend_webhook", async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = req.rawBody?.toString("utf8") ?? "";
    const verified = verifyResendSignature(
      RESEND_WEBHOOK_SECRET.value(),
      {
        id: headerValue(req.headers["svix-id"]),
        timestamp: headerValue(req.headers["svix-timestamp"]),
        signature: headerValue(req.headers["svix-signature"]),
      },
      rawBody,
      Math.floor(Date.now() / 1000),
    );
    if (!verified) {
      logger.warn("resend_webhook: invalid signature");
      res.status(401).send("Invalid signature");
      return;
    }

    let event: ResendEmailEvent;
    try {
      event = JSON.parse(rawBody) as ResendEmailEvent;
    } catch {
      res.status(400).send("Invalid JSON");
      return;
    }

    const db = admin.firestore();
    if (await recordSeasonWrappedClick(db, event)) {
      res.status(200).send("ok");
      return;
    }

    const recorded = await recordEmailIssues(db, event);
    if (recorded > 0) {
      // No addresses in logs; the emailIssues doc holds them for admins.
      logger.info("resend_webhook: email issue recorded", {
        type: event.type,
        emailId: event.data?.email_id,
        category: event.data?.tags?.category,
        recipientCount: recorded,
      });
    }

    res.status(200).send("ok");
  }),
);
