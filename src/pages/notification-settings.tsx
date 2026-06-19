import { useState, useEffect, type SubmitEvent } from "react";
import { isSupported as messagingIsSupported } from "firebase/messaging";
import { Card, Button, Separator, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { saveNotificationPreferences } from "@/api/users";
import type { NotificationPreferences } from "@/api/users";
import {
  resolvePreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/utils/notificationPreferences";
import { useFCMToken } from "@/hooks/useFCMToken";
import { addToast } from "@/providers/toast";
import BackButton from "@/components/back-button";
import { usePageTracking } from "@/hooks/usePageTracking";

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent;
  const isTouchMac =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  return /iPad|iPhone|iPod/i.test(userAgent) || isTouchMac;
}

function isStandaloneApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const standaloneMatch =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  const standaloneNavigator = navigator as Navigator & {
    standalone?: boolean;
  };

  return standaloneMatch || standaloneNavigator.standalone === true;
}

export default function NotificationSettingsPage() {
  usePageTracking("Notification Settings");
  const { user } = useAuth();
  const { userProfile, isLoading } = useUserProfile();
  const { requestPermission } = useFCMToken(user?.uid ?? null);
  const showIosNotificationHelp = isIosDevice();
  const iosStandalone = isStandaloneApp();

  // Track browser-level push permission state
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission | null>(null);
  const [requestingPush, setRequestingPush] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    let cancelled = false;

    messagingIsSupported()
      .then((supported) => {
        if (supported && !cancelled) {
          setPushPermission(Notification.permission);
        }
      })
      .catch((error) => {
        // Firebase messaging support detection failed. Push notifications are optional,
        // so we ignore this for the user experience but log it for debugging.
        console.error("Failed to detect Firebase messaging support", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [_saving, setSaving] = useState(false);

  // Keep local state in sync when the profile finishes loading
  // (only on first successful load, not on every render)
  useEffect(() => {
    if (!isLoading && userProfile) {
      setPrefs(resolvePreferences(userProfile.notificationPreferences));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, userProfile]);

  function toggle(key: keyof NotificationPreferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user?.uid) return;
    setSaving(true);
    try {
      await saveNotificationPreferences(user.uid, prefs);
      addToast({
        title: "Preferences saved",
        description: "Your notification settings have been updated.",
        color: "success",
      });
    } catch (err) {
      addToast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
  }

  return (
    <div className="py-6 flex flex-col items-center px-3 sm:px-4">
      <div className="w-full max-w-lg mb-3">
        <BackButton />
      </div>
      <Card className="w-full max-w-lg p-2">
        <Card.Header className="flex flex-col items-start px-4 pt-4 pb-0 gap-1">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:bell" className="text-xl text-accent" />
            <p className="text-lg font-semibold">Notification Settings</p>
          </div>
          <p className="text-sm text-muted">
            Manage your notification preferences
          </p>
        </Card.Header>
        <Card.Content className="overflow-visible">
          {showIosNotificationHelp && pushPermission !== "granted" && (
            <div
              role="note"
              aria-label="iPhone notification setup"
              className="mb-4 rounded-2xl border border-warning/40 bg-warning/5 px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Icon
                    icon="lucide:smartphone"
                    className="text-xl text-warning"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    iPhone setup required
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    iPhone notifications only work from the Home Screen app, not
                    a regular Safari tab.
                  </p>
                  <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-muted">
                    {!iosStandalone && (
                      <>
                        <li>Open this site in Safari.</li>
                        <li>Tap Share, then Add to Home Screen.</li>
                        <li>Open the RGC app from your Home Screen.</li>
                      </>
                    )}
                    <li>Sign in from the Home Screen app.</li>
                    <li>Come back here and tap Enable notifications.</li>
                    <li>
                      If notifications were previously blocked, re-enable them
                      in iPhone Settings.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Push permission status */}
          {pushPermission !== null && (
            <>
              <div className="flex items-center justify-between gap-3 py-2 mb-1">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      pushPermission === "granted"
                        ? "bg-success/10"
                        : pushPermission === "denied"
                          ? "bg-danger/10"
                          : "bg-default/60"
                    }`}
                  >
                    <Icon
                      icon={
                        pushPermission === "granted"
                          ? "lucide:bell-ring"
                          : pushPermission === "denied"
                            ? "lucide:bell-off"
                            : "lucide:bell"
                      }
                      className={`text-xl ${
                        pushPermission === "granted"
                          ? "text-success"
                          : pushPermission === "denied"
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {pushPermission === "granted"
                        ? "Push notifications enabled"
                        : pushPermission === "denied"
                          ? "Push notifications blocked"
                          : "Push notifications off"}
                    </p>
                    <p className="text-xs text-muted">
                      {pushPermission === "granted"
                        ? "You'll receive alerts even when the app is in the background."
                        : pushPermission === "denied"
                          ? "Unblock in your browser's site settings to enable."
                          : "Enable to receive alerts when the app is in the background."}
                    </p>
                  </div>
                </div>
                {pushPermission === "default" && (
                  <Button
                    size="sm"
                    variant="tertiary"
                    className="shrink-0"
                    isDisabled={requestingPush}
                    onPress={async () => {
                      setRequestingPush(true);
                      await requestPermission();
                      if ("Notification" in window) {
                        setPushPermission(Notification.permission);
                      }
                      setRequestingPush(false);
                    }}
                  >
                    Enable
                  </Button>
                )}
              </div>
              <Separator className="my-3" />
            </>
          )}
          <form className="flex flex-col gap-2" onSubmit={handleSave}>
            {/* Column headers */}
            <div className="flex items-center gap-2 px-4 pb-0.5">
              <div className="flex-1" />
              <div className="flex items-center gap-1 w-16 justify-center text-xs text-muted font-medium">
                <Icon icon="lucide:bell" className="text-sm" />
                Push
              </div>
              <div className="flex items-center gap-1 w-16 justify-center text-xs text-muted font-medium">
                <Icon icon="lucide:mail" className="text-sm" />
                Email
              </div>
            </div>

            {/* Tournament Registration */}
            <div className="flex items-center bg-surface-secondary rounded-lg px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base">Tournament Registration</p>
                <p className="text-sm text-muted">
                  When you are added to a tournament team
                </p>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.tournamentRegistration}
                  onChange={() => toggle("tournamentRegistration")}
                  isDisabled={isLoading}
                  aria-label="Push: Tournament Registration"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.emailTournamentRegistration}
                  onChange={() => toggle("emailTournamentRegistration")}
                  isDisabled={isLoading}
                  aria-label="Email: Tournament Registration"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>

            {/* Tournament Updates */}
            <div className="flex items-center bg-surface-secondary rounded-lg px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base">Tournament Updates & Cancellations</p>
                <p className="text-sm text-muted">
                  When a tournament is canceled or has important updates
                </p>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.tournamentUpdates}
                  onChange={() => toggle("tournamentUpdates")}
                  isDisabled={isLoading}
                  aria-label="Push: Tournament Updates"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.emailTournamentUpdates}
                  onChange={() => toggle("emailTournamentUpdates")}
                  isDisabled={isLoading}
                  aria-label="Email: Tournament Updates"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>

            {/* Announcements */}
            <div className="flex items-center bg-surface-secondary rounded-lg px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base">Announcements</p>
                <p className="text-sm text-muted">
                  Club news and general announcements
                </p>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.generalAnnouncements}
                  onChange={() => toggle("generalAnnouncements")}
                  isDisabled={isLoading}
                  aria-label="Push: Announcements"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.emailGeneralAnnouncements}
                  onChange={() => toggle("emailGeneralAnnouncements")}
                  isDisabled={isLoading}
                  aria-label="Email: Announcements"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>

            {/* New Features */}
            <div className="flex items-center bg-surface-secondary rounded-lg px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-base">New Features</p>
                <p className="text-sm text-muted">
                  New app features and improvements
                </p>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.newFeatures}
                  onChange={() => toggle("newFeatures")}
                  isDisabled={isLoading}
                  aria-label="Push: New Features"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <div className="w-16 flex justify-center">
                <Switch
                  isSelected={prefs.emailNewFeatures}
                  onChange={() => toggle("emailNewFeatures")}
                  isDisabled={isLoading}
                  aria-label="Email: New Features"
                >
                  <Switch.Control className="shrink-0">
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            </div>

            <div className="flex w-full justify-end gap-2 pt-4">
              <Button variant="outline" onPress={handleReset}>
                Reset to Default
              </Button>
              <Button type="submit" isDisabled={isLoading}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
