import type { Timestamp } from "firebase/firestore";

export type NotificationType = "general" | "tournament" | "membership";

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
  /** Optional deep-link payload — used by the service worker and in-app routing. */
  data?: {
    tournamentId?: string;
    link?: string;
  };
}
