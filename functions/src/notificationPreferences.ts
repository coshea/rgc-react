export type NotificationType =
  | "announcement"
  | "tournament"
  | "tournament_canceled"
  | "registration_opening"
  | "registration_closing_soon"
  | "new_features";

export interface UserPrefsData {
  notificationPreferences?: {
    tournamentUpdates?: boolean;
    generalAnnouncements?: boolean;
    newFeatures?: boolean;
  };
}

export function prefKeyForType(
  type: NotificationType,
): keyof NonNullable<UserPrefsData["notificationPreferences"]> | null {
  switch (type) {
    case "announcement":
      return "generalAnnouncements";
    case "tournament":
    case "tournament_canceled":
    case "registration_opening":
    case "registration_closing_soon":
      return "tournamentUpdates";
    case "new_features":
      return "newFeatures";
    default:
      return null;
  }
}

export function userWantsType(
  prefs: UserPrefsData["notificationPreferences"] | undefined,
  type: NotificationType,
): boolean {
  const key = prefKeyForType(type);
  if (!key) return true;
  return prefs?.[key] !== false;
}
