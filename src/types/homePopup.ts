/**
 * Admin-managed popup shown on the home page, stored at `homePopups/{id}`.
 * Each person sees a published popup once; dismissals are keyed by
 * `id` + `version`, so bumping `version` shows it again to everyone.
 */

export const HOME_POPUPS_COLLECTION = "homePopups";
/** Per-member dismissals: `users/{uid}/homePopupDismissals/{popupId}`. */
export const HOME_POPUP_DISMISSALS = "homePopupDismissals";

export const HOME_POPUP_AUDIENCE = {
  EVERYONE: "everyone",
  /** Signed-in users only. */
  MEMBERS: "members",
  /** Only people who aren't signed in, e.g. a welcome message. */
  VISITORS: "visitors",
} as const;
export type HomePopupAudience =
  (typeof HOME_POPUP_AUDIENCE)[keyof typeof HOME_POPUP_AUDIENCE];

export const HOME_POPUP_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;
export type HomePopupStatus =
  (typeof HOME_POPUP_STATUS)[keyof typeof HOME_POPUP_STATUS];

export interface HomePopup {
  id: string;
  title: string;
  /** Short markdown message. */
  body: string;
  ctaLabel?: string;
  /** In-app path (`/membership`) or full https URL. */
  ctaLink?: string;
  audience: HomePopupAudience;
  status: HomePopupStatus;
  /** Date-only, stored as midnight UTC. */
  startDate: Date;
  /** Date-only, stored as midnight UTC. Absent = no end. */
  endDate?: Date;
  version: number;
  templateId?: string;
  publishedAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

/** The fields the editor owns. */
export type HomePopupInput = Pick<
  HomePopup,
  | "title"
  | "body"
  | "ctaLabel"
  | "ctaLink"
  | "audience"
  | "status"
  | "startDate"
  | "endDate"
  | "templateId"
>;

/**
 * What a signed-in member did with a popup, kept for admins at
 * `homePopups/{id}/responses/{uid}`. Visitors are only counted in GA4.
 */
export const HOME_POPUP_RESPONSES = "responses";
/** Longest `link` the rules accept on a response; longer ones are cut. */
export const HOME_POPUP_RESPONSE_LINK_MAX = 500;

export const HOME_POPUP_ACTION = {
  /** Pressed the button or a link in the message. */
  CLICKED: "clicked",
  /** Closed it with X, "Not now", Escape or the backdrop. */
  DISMISSED: "dismissed",
} as const;
export type HomePopupAction =
  (typeof HOME_POPUP_ACTION)[keyof typeof HOME_POPUP_ACTION];

export interface HomePopupResponse {
  uid: string;
  action: HomePopupAction;
  /** The popup version they responded to. */
  version: number;
  /** Where they went, for clicks. */
  link?: string;
  at?: Date;
}

export interface HomePopupDismissal {
  version: number;
  dismissedAt?: Date;
}
