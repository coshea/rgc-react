import * as Sentry from "@sentry/react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDocs,
  increment,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { auth, db } from "@/config/firebase";
import { toDate } from "@/api/users";
import { isFirestoreOfflineError } from "@/utils/firebaseErrors";
import {
  HOME_POPUP_ACTION,
  HOME_POPUP_AUDIENCE,
  HOME_POPUP_DISMISSALS,
  HOME_POPUP_RESPONSE_LINK_MAX,
  HOME_POPUP_RESPONSES,
  HOME_POPUP_STATUS,
  HOME_POPUPS_COLLECTION,
  type HomePopup,
  type HomePopupAction,
  type HomePopupAudience,
  type HomePopupResponse,
  type HomePopupInput,
  type HomePopupStatus,
} from "@/types/homePopup";

function isAudience(value: unknown): value is HomePopupAudience {
  return Object.values(HOME_POPUP_AUDIENCE).includes(value as HomePopupAudience);
}

function isStatus(value: unknown): value is HomePopupStatus {
  return Object.values(HOME_POPUP_STATUS).includes(value as HomePopupStatus);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export function mapHomePopupDoc(
  snap: QueryDocumentSnapshot<DocumentData>,
): HomePopup {
  const data = snap.data();
  return {
    id: snap.id,
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    ctaLabel: optionalString(data.ctaLabel),
    ctaLink: optionalString(data.ctaLink),
    // An unknown audience falls back to the narrowest signed-in one.
    audience: isAudience(data.audience)
      ? data.audience
      : HOME_POPUP_AUDIENCE.MEMBERS,
    status: isStatus(data.status) ? data.status : HOME_POPUP_STATUS.DRAFT,
    startDate: toDate(data.startDate) ?? new Date(0),
    endDate: toDate(data.endDate) ?? undefined,
    version: typeof data.version === "number" ? data.version : 1,
    templateId: optionalString(data.templateId),
    publishedAt: toDate(data.publishedAt) ?? undefined,
    updatedAt: toDate(data.updatedAt) ?? undefined,
    updatedBy: optionalString(data.updatedBy),
  };
}

/** Admin: every popup, drafts included, newest edit first. */
export async function fetchAllHomePopups(): Promise<HomePopup[]> {
  return Sentry.startSpan(
    { name: "fetchAllHomePopups", op: "db.query" },
    async () => {
      try {
        const snap = await getDocs(collection(db, HOME_POPUPS_COLLECTION));
        return snap.docs
          .map(mapHomePopupDoc)
          .sort(
            (a, b) =>
              (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
          );
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    },
  );
}

/**
 * Published popups this viewer may read. Visitors have to leave out
 * members-only popups in the query, or the rules reject the whole query.
 * Signed-in users also get visitors-only ones; `pickLivePopup` drops them.
 */
export async function fetchPublishedHomePopups(
  signedIn: boolean,
): Promise<HomePopup[]> {
  return Sentry.startSpan(
    { name: "fetchPublishedHomePopups", op: "db.query" },
    async () => {
      try {
        const filters = [where("status", "==", HOME_POPUP_STATUS.PUBLISHED)];
        if (!signedIn) {
          filters.push(
            where("audience", "in", [
              HOME_POPUP_AUDIENCE.EVERYONE,
              HOME_POPUP_AUDIENCE.VISITORS,
            ]),
          );
        }
        const snap = await getDocs(
          query(collection(db, HOME_POPUPS_COLLECTION), ...filters),
        );
        return snap.docs.map(mapHomePopupDoc);
      } catch (error) {
        if (!isFirestoreOfflineError(error)) Sentry.captureException(error);
        throw error;
      }
    },
  );
}

export interface SaveHomePopupOptions {
  /** The saved popup being edited; omit to create one. */
  previous?: Pick<HomePopup, "id" | "status">;
  /** Bump the version so people who dismissed it see it again. */
  showAgain?: boolean;
}

/** Admin: create or update a popup. Returns its id. */
export async function saveHomePopup(
  input: HomePopupInput,
  { previous, showAgain = false }: SaveHomePopupOptions = {},
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in to save a popup.");

  const publishing =
    input.status === HOME_POPUP_STATUS.PUBLISHED &&
    previous?.status !== HOME_POPUP_STATUS.PUBLISHED;

  const fields = {
    title: input.title.trim(),
    body: input.body.trim(),
    ctaLabel: input.ctaLabel?.trim() ?? "",
    ctaLink: input.ctaLink?.trim() ?? "",
    audience: input.audience,
    status: input.status,
    startDate: Timestamp.fromDate(input.startDate),
    templateId: input.templateId ?? "",
    updatedAt: serverTimestamp(),
    updatedBy: uid,
    ...(publishing ? { publishedAt: serverTimestamp() } : {}),
  };

  return Sentry.startSpan({ name: "saveHomePopup", op: "db.write" }, async () => {
    try {
      if (!previous) {
        const ref = await addDoc(collection(db, HOME_POPUPS_COLLECTION), {
          ...fields,
          ...(input.endDate
            ? { endDate: Timestamp.fromDate(input.endDate) }
            : {}),
          version: 1,
        });
        return ref.id;
      }
      await updateDoc(doc(db, HOME_POPUPS_COLLECTION, previous.id), {
        ...fields,
        endDate: input.endDate
          ? Timestamp.fromDate(input.endDate)
          : deleteField(),
        ...(showAgain ? { version: increment(1) } : {}),
      });
      return previous.id;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  });
}

/** Admin: delete a popup. Members' dismissal docs for it are left behind; they're tiny and harmless. */
export async function deleteHomePopup(id: string): Promise<void> {
  await Sentry.startSpan({ name: "deleteHomePopup", op: "db.write" }, async () => {
    try {
      await deleteDoc(doc(db, HOME_POPUPS_COLLECTION, id));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  });
}

function isAction(value: unknown): value is HomePopupAction {
  return Object.values(HOME_POPUP_ACTION).includes(value as HomePopupAction);
}

/** Admin: what each signed-in member did with a popup, newest first. */
export async function fetchHomePopupResponses(
  popupId: string,
): Promise<HomePopupResponse[]> {
  return Sentry.startSpan(
    { name: "fetchHomePopupResponses", op: "db.query" },
    async () => {
      try {
        const snap = await getDocs(
          collection(db, HOME_POPUPS_COLLECTION, popupId, HOME_POPUP_RESPONSES),
        );
        return snap.docs
          .map((d): HomePopupResponse | null => {
            const data = d.data();
            if (!isAction(data.action)) return null;
            return {
              uid: d.id,
              action: data.action,
              version: typeof data.version === "number" ? data.version : 1,
              link: optionalString(data.link),
              at: toDate(data.at) ?? undefined,
            };
          })
          .filter((r): r is HomePopupResponse => r !== null)
          .sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    },
  );
}

export type HomePopupResponseCounts = Record<HomePopupAction, number>;

/** Admin: how many members clicked and closed a popup, without reading every response. */
export async function fetchHomePopupResponseCounts(
  popupId: string,
): Promise<HomePopupResponseCounts> {
  return Sentry.startSpan(
    { name: "fetchHomePopupResponseCounts", op: "db.query" },
    async () => {
      try {
        const responses = collection(
          db,
          HOME_POPUPS_COLLECTION,
          popupId,
          HOME_POPUP_RESPONSES,
        );
        const [clicked, dismissed] = await Promise.all(
          [HOME_POPUP_ACTION.CLICKED, HOME_POPUP_ACTION.DISMISSED].map((action) =>
            getCountFromServer(query(responses, where("action", "==", action))),
          ),
        );
        return {
          [HOME_POPUP_ACTION.CLICKED]: clicked.data().count,
          [HOME_POPUP_ACTION.DISMISSED]: dismissed.data().count,
        };
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    },
  );
}

/** Popup id → dismissed version for a signed-in member. */
export async function fetchHomePopupDismissals(
  uid: string,
): Promise<Record<string, number>> {
  return Sentry.startSpan(
    { name: "fetchHomePopupDismissals", op: "db.query" },
    async () => {
      try {
        const snap = await getDocs(
          collection(db, "users", uid, HOME_POPUP_DISMISSALS),
        );
        return Object.fromEntries(
          snap.docs.map((d) => {
            const version: unknown = d.data().version;
            return [d.id, typeof version === "number" ? version : 0];
          }),
        );
      } catch (error) {
        if (!isFirestoreOfflineError(error)) Sentry.captureException(error);
        throw error;
      }
    },
  );
}

/**
 * Hides the popup for this member. With a `response`, also records for admins
 * whether they clicked through or closed it, in the same write. Without one
 * (copying a dismissal made before signing in) nothing is recorded, since we
 * don't know what they did.
 */
export async function recordHomePopupDismissal(
  uid: string,
  popupId: string,
  version: number,
  response?: { action: HomePopupAction; link?: string },
): Promise<void> {
  if (auth.currentUser?.uid !== uid) {
    throw new Error("Can only record dismissals for the signed-in member.");
  }
  await Sentry.startSpan(
    { name: "recordHomePopupDismissal", op: "db.write" },
    async () => {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, "users", uid, HOME_POPUP_DISMISSALS, popupId), {
          version,
          dismissedAt: serverTimestamp(),
        });
        if (response) {
          batch.set(
            doc(db, HOME_POPUPS_COLLECTION, popupId, HOME_POPUP_RESPONSES, uid),
            {
              uid,
              action: response.action,
              version,
              // Cut long links, or the rules reject the whole batch and the
              // dismissal is lost too.
              link: (response.link ?? "").slice(0, HOME_POPUP_RESPONSE_LINK_MAX),
              at: serverTimestamp(),
            },
          );
        }
        await batch.commit();
      } catch (error) {
        if (!isFirestoreOfflineError(error)) Sentry.captureException(error);
        throw error;
      }
    },
  );
}
