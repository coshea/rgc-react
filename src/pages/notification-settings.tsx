import { useState, type FormEvent } from "react";
import { Card, CardHeader, CardBody, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { saveNotificationPreferences } from "@/api/users";
import type { NotificationPreferences } from "@/api/users";
import {
  resolvePreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/utils/notificationPreferences";
import SwitchCell from "@/components/switch-cell";
import { addToast } from "@/providers/toast";
import BackButton from "@/components/back-button";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function NotificationSettingsPage() {
  usePageTracking("Notification Settings");
  const { user } = useAuth();
  const { userProfile, isLoading } = useUserProfile();

  const stored = resolvePreferences(userProfile?.notificationPreferences);

  const [prefs, setPrefs] = useState<NotificationPreferences>(stored);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync when the profile finishes loading
  // (only on first successful load, not on every render)
  const [synced, setSynced] = useState(false);
  if (!isLoading && !synced && userProfile) {
    setPrefs(resolvePreferences(userProfile.notificationPreferences));
    setSynced(true);
  }

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
        <CardBody>
          <form className="flex flex-col gap-2" onSubmit={handleSave}>
            <SwitchCell
              label="Tournament Registration"
              description="Get notified when you are added to a tournament team"
              isSelected={prefs.tournamentRegistration}
              onValueChange={() => toggle("tournamentRegistration")}
              isDisabled={isLoading}
            />
            <SwitchCell
              label="Tournament Updates"
              description="Get notified when tournament details change (time, format, etc.)"
              isSelected={prefs.tournamentUpdates}
              onValueChange={() => toggle("tournamentUpdates")}
              isDisabled={isLoading}
            />
            <SwitchCell
              label="General Announcements"
              description="Get notified about club news and announcements"
              isSelected={prefs.generalAnnouncements}
              onValueChange={() => toggle("generalAnnouncements")}
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
