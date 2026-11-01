import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { HomePopupDialog } from "@/components/home-popup/home-popup-dialog";
import {
  useDismissHomePopup,
  useHomePopupDismissals,
  usePublishedHomePopups,
} from "@/hooks/useHomePopups";
import { useAuth } from "@/providers/AuthProvider";
import {
  HOME_POPUP_ACTION,
  type HomePopup as HomePopupDoc,
  type HomePopupAction,
} from "@/types/homePopup";
import { AnalyticsEvent, trackEvent } from "@/utils/analytics";
import {
  hasMemberOnDevice,
  isDismissed,
  isInternalLink,
  pickLivePopup,
  readLocalDismissals,
} from "@/utils/homePopup";

function analyticsParams(popup: HomePopupDoc) {
  return {
    popup_id: popup.id,
    version: popup.version,
    template: popup.templateId ?? "",
    audience: popup.audience,
  };
}

/**
 * Shows the live home popup once per person. Waits for auth so a
 * members-only popup never flashes for visitors, and for a member's saved
 * dismissals so it doesn't reappear on their other devices.
 */
export function HomePopup() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const signedIn = !!user;

  const published = usePublishedHomePopups(signedIn, !loading);
  const remote = useHomePopupDismissals(user?.uid);
  const dismiss = useDismissHomePopup(user?.uid);
  const [local] = useState(readLocalDismissals);
  const [memberOnDevice] = useState(hasMemberOnDevice);
  const [closedKey, setClosedKey] = useState<string | null>(null);

  const popup = useMemo(
    () => pickLivePopup(published.data ?? [], { signedIn, memberOnDevice }),
    [published.data, signedIn, memberOnDevice],
  );

  const waiting = loading || published.isLoading || (signedIn && remote.isLoading);
  const key = popup ? `${popup.id}:${popup.version}` : null;
  const show =
    !waiting &&
    !!popup &&
    closedKey !== key &&
    !isDismissed(popup, local) &&
    !isDismissed(popup, remote.data ?? {});

  // Dismissed before signing in? Copy it to the account so the member's other
  // devices don't show it again.
  const syncedKey = useRef<string | null>(null);
  const { mutate: dismissMutate } = dismiss;
  useEffect(() => {
    if (!signedIn || !popup || !remote.data || syncedKey.current === key) return;
    if (isDismissed(popup, local) && !isDismissed(popup, remote.data)) {
      syncedKey.current = key;
      dismissMutate({ id: popup.id, version: popup.version });
    }
  }, [signedIn, popup, remote.data, local, key, dismissMutate]);

  const trackedKey = useRef<string | null>(null);
  useEffect(() => {
    if (show && popup && trackedKey.current !== key) {
      trackedKey.current = key;
      trackEvent(AnalyticsEvent.HOME_POPUP_VIEW, analyticsParams(popup));
    }
  }, [show, popup, key]);

  if (!popup || !show) return null;

  const close = (action: HomePopupAction, link?: string) => {
    setClosedKey(key);
    dismiss.mutate({
      id: popup.id,
      version: popup.version,
      response: { action, link },
    });
  };

  return (
    <HomePopupDialog
      popup={popup}
      isOpen
      onClose={() => {
        trackEvent(AnalyticsEvent.HOME_POPUP_DISMISS, analyticsParams(popup));
        close(HOME_POPUP_ACTION.DISMISSED);
      }}
      onFollowLink={(link, { browserOpens = false } = {}) => {
        trackEvent(AnalyticsEvent.HOME_POPUP_CLICK, {
          ...analyticsParams(popup),
          link,
        });
        close(HOME_POPUP_ACTION.CLICKED, link);
        if (browserOpens) return;
        if (isInternalLink(link)) navigate(link);
        else window.open(link, "_blank", "noopener,noreferrer");
      }}
    />
  );
}
