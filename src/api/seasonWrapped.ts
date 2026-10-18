import * as Sentry from "@sentry/react";
import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { db, functions } from "@/config/firebase";
import {
  SEASON_WRAPPED_COLLECTION,
  SEASON_WRAPPED_DELIVERY,
  SEASON_WRAPPED_MEMBERS,
  SEASON_WRAPPED_VIEWS,
  type GenerateSeasonWrappedRequest,
  type GenerateSeasonWrappedResponse,
  type GetShareImageRequest,
  type GetShareImageResponse,
  type PublishSeasonWrappedRequest,
  type SeasonWrappedDelivery,
  type SeasonWrappedMember,
  type SeasonWrappedSeason,
  type SeasonWrappedSource,
  type SeasonWrappedView,
  type SendSeasonWrappedRequest,
  type SendSeasonWrappedResponse,
  type SendSeasonWrappedTestRequest,
} from "@@/seasonWrapped/types";

/** True when Firestore denied the read, e.g. the season isn't published yet. */
function isPermissionDenied(error: unknown): boolean {
  return error instanceof FirebaseError && error.code === "permission-denied";
}

/**
 * The season doc, or null when it doesn't exist or isn't visible yet (members
 * can't read a draft). Other errors are thrown.
 */
export async function fetchWrappedSeason(
  year: number,
): Promise<SeasonWrappedSeason | null> {
  return Sentry.startSpan(
    { name: "fetchWrappedSeason", op: "db.query" },
    async () => {
      try {
        const snap = await getDoc(doc(db, SEASON_WRAPPED_COLLECTION, String(year)));
        return snap.exists() ? (snap.data() as SeasonWrappedSeason) : null;
      } catch (error) {
        if (isPermissionDenied(error)) return null;
        Sentry.captureException(error);
        throw error;
      }
    },
  );
}

/** A member's story, or null when there isn't one they can see. */
export async function fetchWrappedStory(
  year: number,
  uid: string,
): Promise<SeasonWrappedMember | null> {
  return Sentry.startSpan(
    { name: "fetchWrappedStory", op: "db.query" },
    async () => {
      try {
        const snap = await getDoc(
          doc(db, SEASON_WRAPPED_COLLECTION, String(year), SEASON_WRAPPED_MEMBERS, uid),
        );
        return snap.exists() ? (snap.data() as SeasonWrappedMember) : null;
      } catch (error) {
        if (isPermissionDenied(error)) return null;
        Sentry.captureException(error);
        throw error;
      }
    },
  );
}

export interface WrappedAdminRow {
  story: SeasonWrappedMember;
  delivery?: SeasonWrappedDelivery;
  view?: SeasonWrappedView;
}

/** Every member's story with delivery and open tracking. Admin only. */
export async function fetchWrappedAdminRows(
  year: number,
): Promise<WrappedAdminRow[]> {
  return Sentry.startSpan(
    { name: "fetchWrappedAdminRows", op: "db.query" },
    async () => {
      try {
        const base = [SEASON_WRAPPED_COLLECTION, String(year)] as const;
        const [members, deliveries, views] = await Promise.all([
          getDocs(collection(db, ...base, SEASON_WRAPPED_MEMBERS)),
          getDocs(collection(db, ...base, SEASON_WRAPPED_DELIVERY)),
          getDocs(collection(db, ...base, SEASON_WRAPPED_VIEWS)),
        ]);
        const deliveryById = new Map(
          deliveries.docs.map((d) => [d.id, d.data() as SeasonWrappedDelivery]),
        );
        const viewById = new Map(
          views.docs.map((d) => [d.id, d.data() as SeasonWrappedView]),
        );
        return members.docs.map((d) => ({
          story: d.data() as SeasonWrappedMember,
          delivery: deliveryById.get(d.id),
          view: viewById.get(d.id),
        }));
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    },
  );
}

export interface WrappedViewUpdate {
  source: SeasonWrappedSource;
  /** True once per page load; bumps the open count. */
  newOpen: boolean;
  /** 1-based index of the card on screen. */
  card: number;
  cardCount: number;
  shared?: boolean;
}

/**
 * Records the member's own progress through their story. Counts only move
 * forward (the rules enforce it too). Never call this for admin previews.
 */
export async function recordWrappedView(
  year: number,
  uid: string,
  update: WrappedViewUpdate,
): Promise<void> {
  const ref = doc(db, SEASON_WRAPPED_COLLECTION, String(year), SEASON_WRAPPED_VIEWS, uid);
  await Sentry.startSpan({ name: "recordWrappedView", op: "db.write" }, () =>
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.exists() ? (snap.data() as SeasonWrappedView) : null;
      const furthestCard = Math.max(prev?.furthestCard ?? 0, update.card);
      const sources = { ...(prev?.sources ?? {}) };
      if (update.newOpen) sources[update.source] = (sources[update.source] ?? 0) + 1;

      tx.set(ref, {
        uid,
        openCount: (prev?.openCount ?? 0) + (update.newOpen ? 1 : 0),
        firstOpenedAt: prev?.firstOpenedAt ?? serverTimestamp(),
        lastOpenedAt: update.newOpen || !prev ? serverTimestamp() : prev.lastOpenedAt,
        furthestCard,
        cardCount: update.cardCount,
        completed: (prev?.completed ?? false) || furthestCard >= update.cardCount,
        shared: (prev?.shared ?? false) || update.shared === true,
        firstSource: prev?.firstSource ?? update.source,
        sources,
      });
    }),
  );
}

// ---------------------------------------------------------------------------
// Callables (admin, except the share image)
// ---------------------------------------------------------------------------

async function call<Req, Res>(name: string, data: Req): Promise<Res> {
  return Sentry.startSpan({ name, op: "http.client" }, async () => {
    const fn = httpsCallable<Req, Res>(functions, name);
    const result = await fn(data);
    return result.data;
  });
}

export function generateWrapped(req: GenerateSeasonWrappedRequest) {
  return call<GenerateSeasonWrappedRequest, GenerateSeasonWrappedResponse>(
    "generate_season_wrapped",
    req,
  );
}

export function publishWrapped(req: PublishSeasonWrappedRequest) {
  return call<PublishSeasonWrappedRequest, { ok: true; published: boolean }>(
    "publish_season_wrapped",
    req,
  );
}

export function sendWrappedAnnouncements(req: SendSeasonWrappedRequest) {
  return call<SendSeasonWrappedRequest, SendSeasonWrappedResponse>(
    "send_season_wrapped_announcements",
    req,
  );
}

export function sendWrappedTest(req: SendSeasonWrappedTestRequest) {
  return call<SendSeasonWrappedTestRequest, { ok: true; email: string }>(
    "send_season_wrapped_test",
    req,
  );
}

/** The member's share card as a PNG blob. */
export async function fetchWrappedShareImage(req: GetShareImageRequest): Promise<Blob> {
  const res = await call<GetShareImageRequest, GetShareImageResponse>(
    "get_season_wrapped_share_image",
    req,
  );
  const bytes = Uint8Array.from(atob(res.image), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: "image/png" });
}
