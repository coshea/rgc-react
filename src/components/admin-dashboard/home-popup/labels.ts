import { HOME_POPUP_AUDIENCE, type HomePopupAudience } from "@/types/homePopup";
import { HOME_POPUP_STATE, type HomePopupState } from "@/utils/homePopup";

const AUDIENCE_LABELS: Record<HomePopupAudience, string> = {
  [HOME_POPUP_AUDIENCE.EVERYONE]: "Everyone",
  [HOME_POPUP_AUDIENCE.MEMBERS]: "Members only",
  [HOME_POPUP_AUDIENCE.VISITORS]: "Visitors only",
};

export function audienceLabel(audience: HomePopupAudience): string {
  return AUDIENCE_LABELS[audience];
}

/** What each audience means, shown under the picker in the editor. */
export const AUDIENCE_HELP: Record<HomePopupAudience, string> = {
  [HOME_POPUP_AUDIENCE.EVERYONE]:
    "Visitors and signed-in members. A visitor's dismissal is remembered on their device; a member's is saved to their account.",
  [HOME_POPUP_AUDIENCE.MEMBERS]: "Only signed-in members. Visitors never see it.",
  [HOME_POPUP_AUDIENCE.VISITORS]:
    "Only people who aren't signed in, like a welcome for someone new to the site. Members never see it, even after signing out on their device.",
};

export const STATE_META: Record<
  HomePopupState,
  { label: string; color: "success" | "warning" | "default" }
> = {
  [HOME_POPUP_STATE.LIVE]: { label: "Live", color: "success" },
  [HOME_POPUP_STATE.SCHEDULED]: { label: "Scheduled", color: "warning" },
  [HOME_POPUP_STATE.ENDED]: { label: "Ended", color: "default" },
  [HOME_POPUP_STATE.DRAFT]: { label: "Draft", color: "default" },
};
