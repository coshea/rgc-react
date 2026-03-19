import { useState, useEffect, type FormEvent } from "react";
import { Card, CardHeader, CardBody, Button, Divider } from "@heroui/react";
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
import SwitchCell from "@/components/switch-cell";
import { addToast } from "@/providers/toast";
import BackButton from "@/components/back-button";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function NotificationSettingsPage() {
  usePageTracking("Notification Settings");
  const { user } = useAuth();
  const { userProfile, isLoading } = useUserProfile();
  const { requestPermission } = useFCMToken(user?.uid ?? null);

  // Track browser-level push permission state
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission | null>(null);
  const [requestingPush, setRequestingPush] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [saving, setSaving] = useState(false);

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

  async function handleSave(e: FormEvent) {
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
        <CardHeader className="flex flex-col items-start px-4 pt-4 pb-0 gap-1">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:bell" className="text-xl text-primary" />
            <p className="text-large font-semibold">Notification Settings</p>
          </div>
          <p className="text-small text-default-500">
            Manage your notification preferences
          </p>
        </CardHeader>
        <CardBody className="overflow-visible">
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
                          : "bg-default-100"
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
                            : "text-default-400"
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
                    <p className="text-xs text-default-400">
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
                    color="primary"
                    variant="flat"
                    className="shrink-0"
                    isLoading={requestingPush}
                    startContent={
                      !requestingPush && (
                        <Icon icon="lucide:bell" className="text-sm" />
                      )
                    }
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
              <Divider className="my-3" />
            </>
          )}
          <form className="flex flex-col gap-2" onSubmit={handleSave}>
            <SwitchCell
              label="Tournament Registration"
              description="Get notified when you are added to a tournament team"
              isSelected={prefs.tournamentRegistration}
              onValueChange={() => toggle("tournamentRegistration")}
              isDisabled={isLoading}
            />
            <SwitchCell
              label="Tournament Updates & Cancellations"
              description="Get notified when a tournament is canceled or has important updates"
              isSelected={prefs.tournamentUpdates}
              onValueChange={() => toggle("tournamentUpdates")}
              isDisabled={isLoading}
            />
            <SwitchCell
              label="Announcements"
              description="Get notified about club news and general announcements"
              isSelected={prefs.generalAnnouncements}
              onValueChange={() => toggle("generalAnnouncements")}
              isDisabled={isLoading}
            />
            <SwitchCell
              label="New Features"
              description="Get notified about new app features and improvements"
              isSelected={prefs.newFeatures}
              onValueChange={() => toggle("newFeatures")}
              isDisabled={isLoading}
            />

            <div className="flex w-full justify-end gap-2 pt-4">
              <Button variant="bordered" onPress={handleReset}>
                Reset to Default
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={saving}
                isDisabled={isLoading}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
