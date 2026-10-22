import { createHmac, timingSafeEqual } from "node:crypto";

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

import { logger } from "./logger";
import { withSentry } from "./sentry";
import {
  CONTACT_EMAIL,
  FONT,
  MANAGE_NOTIFICATIONS_URL,
} from "./sendRegistrationOpeningEmails";

/**
 * HMAC key that signs unsubscribe links. Set it once with
 * `firebase functions:secrets:set EMAIL_UNSUBSCRIBE_SECRET` (any long random
 * string, e.g. `openssl rand -base64 32`). Rotating it voids links in emails
 * already sent.
 */
export const EMAIL_UNSUBSCRIBE_SECRET_NAME = "EMAIL_UNSUBSCRIBE_SECRET";
export const EMAIL_UNSUBSCRIBE_SECRET = defineSecret(
  EMAIL_UNSUBSCRIBE_SECRET_NAME,
);

/** Each topic turns off one email preference on `users/{uid}`. */
export const UNSUBSCRIBE_TOPICS = {
  tournament_updates: {
    field: "emailTournamentUpdates",
    label: "tournament update emails (like registration opening)",
  },
  announcements: {
    field: "emailGeneralAnnouncements",
    label: "club announcement emails (like Season Wrapped)",
  },
} as const;

export type UnsubscribeTopic = keyof typeof UNSUBSCRIBE_TOPICS;

const FUNCTION_NAME = "email_unsubscribe";
const DEFAULT_PROJECT_ID = "ridgefield-golf-club";

function isUnsubscribeTopic(value: unknown): value is UnsubscribeTopic {
  return typeof value === "string" && Object.hasOwn(UNSUBSCRIBE_TOPICS, value);
}

function sign(key: string, uid: string, topic: UnsubscribeTopic): string {
  return createHmac("sha256", key)
    .update(`unsubscribe:v1:${uid}:${topic}`)
    .digest("base64url");
}

export function verifyUnsubscribeSignature(
  key: string,
  uid: string,
  topic: UnsubscribeTopic,
  signature: string,
): boolean {
  if (!key || !uid || !signature) return false;
  const expected = Buffer.from(sign(key, uid, topic));
  const candidate = Buffer.from(signature);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

function functionUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;
  return `https://us-central1-${projectId}.cloudfunctions.net/${FUNCTION_NAME}`;
}

/**
 * Signed one-click unsubscribe link for one member and topic, or undefined
 * when the secret isn't configured (emails then fall back to the settings
 * page link).
 */
export function buildUnsubscribeUrl(
  key: string,
  uid: string,
  topic: UnsubscribeTopic,
): string | undefined {
  if (!key || !uid) return undefined;
  const url = new URL(functionUrl());
  url.searchParams.set("u", uid);
  url.searchParams.set("t", topic);
  url.searchParams.set("s", sign(key, uid, topic));
  return url.toString();
}

/** Reads the signing key, or "" when it isn't set. */
export function unsubscribeKey(): string {
  return EMAIL_UNSUBSCRIBE_SECRET.value();
}

/**
 * Turns the topic's email preference off. Returns false when the user doc no
 * longer exists (nothing to unsubscribe).
 */
export async function applyUnsubscribe(
  db: admin.firestore.Firestore,
  uid: string,
  topic: UnsubscribeTopic,
): Promise<boolean> {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({
    [`notificationPreferences.${UNSUBSCRIBE_TOPICS[topic].field}`]: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderUnsubscribePage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Ridgefield Golf Club</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f4f4f5;font-family:${FONT};color:#11181c;">
  <main style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;padding:32px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#2c8a4b;">Ridgefield Golf Club</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${esc(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#71717a;">Questions? Email <a href="mailto:${CONTACT_EMAIL}" style="color:#006fee;">${CONTACT_EMAIL}</a>.</p>
  </main>
</body>
</html>`;
}

const PARAGRAPH = `style="margin:0 0 16px;font-size:16px;line-height:1.6;"`;
const MANAGE_LINK = `<a href="${MANAGE_NOTIFICATIONS_URL}" style="color:#006fee;">manage all your notification settings</a>`;

function confirmPage(topic: UnsubscribeTopic, query: string): string {
  return renderUnsubscribePage(
    "Unsubscribe?",
    `<p ${PARAGRAPH}>You'll stop getting ${esc(UNSUBSCRIBE_TOPICS[topic].label)}. Other emails you've turned on are unchanged.</p>
    <form method="POST" action="?${esc(query)}">
      <input type="hidden" name="List-Unsubscribe" value="One-Click">
      <button type="submit" style="min-height:44px;padding:0 20px;border:0;border-radius:8px;background:#0c2a1c;color:#ffffff;font-size:16px;font-weight:600;cursor:pointer;">Unsubscribe</button>
    </form>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#71717a;">Or sign in to ${MANAGE_LINK}.</p>`,
  );
}

function donePage(topic: UnsubscribeTopic): string {
  return renderUnsubscribePage(
    "You're unsubscribed",
    `<p ${PARAGRAPH}>You won't get ${esc(UNSUBSCRIBE_TOPICS[topic].label)} anymore.</p>
    <p ${PARAGRAPH}>Changed your mind? Sign in to ${MANAGE_LINK}.</p>`,
  );
}

const INVALID_PAGE = renderUnsubscribePage(
  "Link not recognized",
  `<p ${PARAGRAPH}>This unsubscribe link is incomplete or no longer valid. Sign in to ${MANAGE_LINK}, or email us and we'll take care of it.</p>`,
);

function queryValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * One-click unsubscribe (RFC 8058) for member emails. Mail clients POST
 * `List-Unsubscribe=One-Click` to the signed URL in the List-Unsubscribe
 * header; a GET (someone clicking the footer link) shows a confirm button
 * instead, so link scanners that prefetch URLs can't unsubscribe anyone.
 */
export const email_unsubscribe = onRequest(
  { secrets: [EMAIL_UNSUBSCRIBE_SECRET] },
  withSentry(FUNCTION_NAME, async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex");
    res.type("html");

    if (req.method !== "GET" && req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const uid = queryValue(req.query.u);
    const topic = queryValue(req.query.t);
    const signature = queryValue(req.query.s);
    if (
      !isUnsubscribeTopic(topic) ||
      !verifyUnsubscribeSignature(unsubscribeKey(), uid, topic, signature)
    ) {
      logger.warn("email_unsubscribe: invalid link", { method: req.method });
      res.status(400).send(INVALID_PAGE);
      return;
    }

    if (req.method === "GET") {
      const query = new URLSearchParams({ u: uid, t: topic, s: signature });
      res.status(200).send(confirmPage(topic, query.toString()));
      return;
    }

    const found = await applyUnsubscribe(admin.firestore(), uid, topic);
    logger.info("email_unsubscribe: preference turned off", {
      uid,
      topic,
      found,
    });
    res.status(200).send(donePage(topic));
  }),
);
