import {
  HOME_POPUP_AUDIENCE,
  HOME_POPUP_STATUS,
  type HomePopup,
  type HomePopupAudience,
  type HomePopupInput,
} from "@/types/homePopup";

export interface HomePopupTemplate {
  id: string;
  name: string;
  /** When to use it, shown under the name in the picker. */
  hint: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaLink: string;
  audience: HomePopupAudience;
}

/**
 * Starting points for the editor. Text in `[CAPS]` is a placeholder the admin
 * must replace before publishing. Tournament registration has its own emails,
 * so there's deliberately no tournament template.
 */
export const HOME_POPUP_TEMPLATES: readonly HomePopupTemplate[] = [
  {
    id: "membership-open",
    name: "Memberships are open",
    hint: "Start of the season",
    title: "[YEAR] memberships are open",
    body: "Renew before the first tournament to keep your spot on the money list and get registration emails.",
    ctaLabel: "Renew membership",
    ctaLink: "/membership",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
  },
  {
    id: "welcome",
    name: "Welcome",
    hint: "First visit, not signed in",
    title: "Welcome to Ridgefield Golf Club",
    body: "Our home course is Ridgefield Golf Course in Ridgefield, CT. Members play club tournaments all season, chase the money list and find partners for a round.",
    ctaLabel: "Become a member",
    ctaLink: "/membership",
    audience: HOME_POPUP_AUDIENCE.VISITORS,
  },
  {
    id: "renewal-reminder",
    name: "Renewal reminder",
    hint: "Before the renewal deadline",
    title: "Last call to renew for [YEAR]",
    body: "Memberships close on [DATE]. Renew now so you can keep registering for tournaments.",
    ctaLabel: "Renew membership",
    ctaLink: "/membership",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
  },
  {
    id: "season-wrapped",
    name: "Season Wrapped is here",
    hint: "After Season Wrapped is published",
    title: "Your [YEAR] Season Wrapped is here",
    body: "See your rounds, winnings and highlights from the season.",
    ctaLabel: "See my season",
    ctaLink: "/wrapped/[YEAR]",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
  },
  {
    id: "policy-update",
    name: "Rules or policy update",
    hint: "Local rules, handicap policy",
    title: "Updated: [POLICY NAME]",
    body: "We changed this for the new season. Please take a minute to read it before you play.",
    ctaLabel: "Read the update",
    ctaLink: "/policies",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
  },
  {
    id: "notifications",
    name: "Turn on notifications",
    hint: "Get members onto app alerts",
    title: "Never miss a registration",
    body: "Turn on notifications to hear when registration opens and results are posted.",
    ctaLabel: "Notification settings",
    ctaLink: "/settings/notifications",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
  },
  {
    id: "complete-profile",
    name: "Complete your profile",
    hint: "Photos and phone numbers",
    title: "Add your photo and phone number",
    body: "It helps other members find you in the directory and set up a game.",
    ctaLabel: "Edit profile",
    ctaLink: "/profile",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
  },
  {
    id: "find-a-game",
    name: "Find a Game",
    hint: "Promote playing partners",
    title: "Looking for a game?",
    body: "Post when you want to play and find partners on Find a Game.",
    ctaLabel: "Find a Game",
    ctaLink: "/find-a-game",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
  },
  {
    id: "club-event",
    name: "Club event",
    hint: "Meeting, dinner, outing",
    title: "[EVENT NAME] on [DATE]",
    body: "[WHERE AND WHAT]. Let us know if you can make it.",
    ctaLabel: "Contact us",
    ctaLink: "/contact",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
  },
  {
    id: "news-post",
    name: "Club news post",
    hint: "Points to a post in Announcements",
    title: "[HEADLINE]",
    body: "[ONE OR TWO SENTENCES]. Read the full post for details.",
    ctaLabel: "Read more",
    ctaLink: "/announcements/[POST]",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
  },
  {
    id: "blank",
    name: "Blank",
    hint: "Write your own",
    title: "",
    body: "",
    ctaLabel: "",
    ctaLink: "",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
  },
];

export const BLANK_TEMPLATE_ID = "blank";

export function findHomePopupTemplate(id: string | undefined) {
  return HOME_POPUP_TEMPLATES.find((t) => t.id === id);
}

/** Uppercase `[PLACEHOLDER]`s left in the text. Markdown links (`[text](url)`) don't match. */
export function findPlaceholders(text: string): string[] {
  return text.match(/\[[A-Z][A-Z0-9 ]*\](?!\()/g) ?? [];
}

export function isInternalLink(link: string): boolean {
  return link.startsWith("/") && !link.startsWith("//");
}

/** A button link must be an in-app path or an https URL. */
export function isValidCtaLink(link: string): boolean {
  if (isInternalLink(link)) return true;
  try {
    return new URL(link).protocol === "https:";
  } catch {
    return false;
  }
}

/** `"YYYY-MM-DD"` → midnight UTC. */
export function ymdToUtcDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

/** Midnight-UTC date → `"YYYY-MM-DD"`. */
export function utcDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's local calendar date as midnight UTC, comparable with stored dates. */
export function todayUtc(now = new Date()): Date {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return ymdToUtcDate(`${y}-${m}-${d}`);
}

export function formatPopupDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const HOME_POPUP_STATE = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  LIVE: "live",
  ENDED: "ended",
} as const;
export type HomePopupState =
  (typeof HOME_POPUP_STATE)[keyof typeof HOME_POPUP_STATE];

export function homePopupState(
  popup: Pick<HomePopup, "status" | "startDate" | "endDate">,
  today = todayUtc(),
): HomePopupState {
  if (popup.status !== HOME_POPUP_STATUS.PUBLISHED)
    return HOME_POPUP_STATE.DRAFT;
  if (popup.startDate.getTime() > today.getTime())
    return HOME_POPUP_STATE.SCHEDULED;
  if (popup.endDate && popup.endDate.getTime() < today.getTime()) {
    return HOME_POPUP_STATE.ENDED;
  }
  return HOME_POPUP_STATE.LIVE;
}

export function isAudienceFor(
  audience: HomePopupAudience,
  signedIn: boolean,
): boolean {
  if (audience === HOME_POPUP_AUDIENCE.MEMBERS) return signedIn;
  if (audience === HOME_POPUP_AUDIENCE.VISITORS) return !signedIn;
  return true;
}

/** The popup to show: live, meant for this viewer, most recently published. */
export function pickLivePopup(
  popups: readonly HomePopup[],
  signedIn: boolean,
  today = todayUtc(),
): HomePopup | null {
  const live = popups.filter(
    (p) =>
      homePopupState(p, today) === HOME_POPUP_STATE.LIVE &&
      isAudienceFor(p.audience, signedIn),
  );
  live.sort(
    (a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
  );
  return live[0] ?? null;
}

export const HOME_POPUP_TITLE_MAX = 60;

/** Editor state. Dates are `"YYYY-MM-DD"`; `endYmd` is empty for no end. */
export interface HomePopupForm {
  title: string;
  body: string;
  ctaLabel: string;
  ctaLink: string;
  audience: HomePopupAudience;
  startYmd: string;
  endYmd: string;
  templateId: string;
}

/** New popups end this many days after they start, so none is left up by accident. */
export const HOME_POPUP_DEFAULT_DAYS = 30;

/** `"YYYY-MM-DD"` plus `days`, in UTC. */
export function addDaysYmd(ymd: string, days: number): string {
  const date = ymdToUtcDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToYmd(date);
}

/** The end date a popup starting on `startYmd` gets by default. */
export function defaultEndYmd(startYmd: string): string {
  return addDaysYmd(startYmd, HOME_POPUP_DEFAULT_DAYS);
}

export function formFromTemplate(
  template: HomePopupTemplate,
  today = todayUtc(),
): HomePopupForm {
  const startYmd = utcDateToYmd(today);
  return {
    title: template.title,
    body: template.body,
    ctaLabel: template.ctaLabel,
    ctaLink: template.ctaLink,
    audience: template.audience,
    startYmd,
    endYmd: defaultEndYmd(startYmd),
    templateId: template.id,
  };
}

export function formFromPopup(popup: HomePopup): HomePopupForm {
  return {
    title: popup.title,
    body: popup.body,
    ctaLabel: popup.ctaLabel ?? "",
    ctaLink: popup.ctaLink ?? "",
    audience: popup.audience,
    startYmd: utcDateToYmd(popup.startDate),
    endYmd: popup.endDate ? utcDateToYmd(popup.endDate) : "",
    templateId: popup.templateId ?? "",
  };
}

export function formToInput(
  form: HomePopupForm,
  status: HomePopup["status"],
): HomePopupInput {
  return {
    title: form.title,
    body: form.body,
    ctaLabel: form.ctaLabel,
    ctaLink: form.ctaLink,
    audience: form.audience,
    status,
    startDate: ymdToUtcDate(form.startYmd),
    endDate: form.endYmd ? ymdToUtcDate(form.endYmd) : undefined,
    templateId: form.templateId || undefined,
  };
}

export type HomePopupFormErrors = Partial<Record<keyof HomePopupForm, string>>;

/**
 * Drafts only need valid dates. Going live also needs a title and message,
 * a complete and valid button, and no `[PLACEHOLDER]`s left.
 */
export function validateHomePopupForm(
  form: HomePopupForm,
  { publishing }: { publishing: boolean },
): HomePopupFormErrors {
  const errors: HomePopupFormErrors = {};
  if (!form.startYmd) errors.startYmd = "Pick a start date.";
  if (form.startYmd && form.endYmd && form.endYmd < form.startYmd) {
    errors.endYmd = "The end date is before the start date.";
  }
  if (form.title.length > HOME_POPUP_TITLE_MAX) {
    errors.title = `Keep the title to ${HOME_POPUP_TITLE_MAX} characters.`;
  }
  if (!publishing) return errors;

  const placeholderError = (text: string) => {
    const found = findPlaceholders(text);
    return found.length
      ? `Replace ${found.join(", ")} before publishing.`
      : undefined;
  };

  const title = form.title.trim();
  const body = form.body.trim();
  const ctaLabel = form.ctaLabel.trim();
  const ctaLink = form.ctaLink.trim();

  if (!title) errors.title = "Add a title.";
  else errors.title ??= placeholderError(title);
  if (!body) errors.body = "Add a message.";
  else errors.body = placeholderError(body);
  if (ctaLabel && !ctaLink) errors.ctaLink = "Add where the button goes.";
  if (ctaLink && !ctaLabel) errors.ctaLabel = "Add a button label.";
  if (ctaLabel) errors.ctaLabel = placeholderError(ctaLabel);
  if (ctaLink) {
    errors.ctaLink =
      placeholderError(ctaLink) ??
      (isValidCtaLink(ctaLink)
        ? undefined
        : "Use a site path like /membership or a full https:// link.");
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message),
  );
}

const LOCAL_DISMISSALS_KEY = "rgc.homePopupDismissals";

/** Popup id → dismissed version, remembered on this device. */
export function readLocalDismissals(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_DISMISSALS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  } catch {
    return {};
  }
}

export function rememberLocalDismissal(id: string, version: number): void {
  try {
    const next = { ...readLocalDismissals(), [id]: version };
    localStorage.setItem(LOCAL_DISMISSALS_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode): the popup may show again, which is fine.
  }
}

export function isDismissed(
  popup: Pick<HomePopup, "id" | "version">,
  dismissals: Record<string, number>,
): boolean {
  return (dismissals[popup.id] ?? -1) >= popup.version;
}
