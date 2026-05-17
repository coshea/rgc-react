import type { Timestamp } from "firebase/firestore";

export type NotificationType =
  | "announcement"
  | "tournament"
  | "tournament_canceled"
  | "registration_opening"
  | "registration_closing_soon"
  | "new_features";

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  {
    label: string;
    icon: string;
    color: "default" | "accent" | "success" | "warning" | "danger";
  }
> = {
  announcement: {
    label: "Announcement",
    icon: "lucide:megaphone",
    color: "default",
  },
  tournament: { label: "Tournament", icon: "lucide:trophy", color: "accent" },
  new_features: {
    label: "New Features",
    icon: "lucide:sparkles",
    color: "success",
  },
  tournament_canceled: {
    label: "Tournament Canceled",
    icon: "lucide:x-circle",
    color: "danger",
  },
  registration_opening: {
    label: "Registration Opening",
    icon: "lucide:calendar-check",
    color: "success",
  },
  registration_closing_soon: {
    label: "Registration Closing Soon",
    icon: "lucide:calendar-clock",
    color: "warning",
  },
};

export interface AppNotification {
  id: string;
  /** Target user's Firebase Auth UID. */
  uid: string;
  title: string;
  body: string;
  type: NotificationType;
  /** False on creation; toggled to true when the user views/acknowledges. */
  read: boolean;
  createdAt: Timestamp;
  /** Firestore TTL field — document is automatically deleted after this timestamp (60 days). */
  expiresAt: Timestamp;
  /** Optional deep-link payload — used by the service worker and in-app routing. */
  data?: {
    tournamentId?: string;
    link?: string;
  };
}
