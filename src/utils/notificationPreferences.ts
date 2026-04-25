import type { NotificationPreferences } from "@/api/users";

/**
 * Defaults applied when a user has never saved preferences, or when a new
 * preference key is added and doesn't yet exist on their stored document.
 * All notification types default to true (opt-in).
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  tournamentRegistration: true,
  tournamentUpdates: true,
  generalAnnouncements: true,
  newFeatures: true,
  emailEnabled: true,
  emailTournamentRegistration: true,
  emailTournamentUpdates: true,
  emailGeneralAnnouncements: true,
  emailNewFeatures: true,
};

/**
 * Merge stored preferences with the defaults so any newly-added keys are
 * transparently treated as enabled without requiring a migration.
 */
export function resolvePreferences(
  stored: Partial<NotificationPreferences> | undefined,
): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...stored };
}
