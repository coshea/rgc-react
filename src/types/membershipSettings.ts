/**
 * Membership registration settings stored in Firestore at:
 * /config/membershipSettings
 *
 * This document controls pricing and whether registration is open.
 */
export interface MembershipSettings {
  /** Is registration currently open for new/renewal members? */
  registrationOpen: boolean;

  /** Price for full membership (in dollars) */
  fullMembershipPrice: number;

  /** Price for handicap membership (in dollars) */
  handicapMembershipPrice: number;

  /** Message to display when registration is closed */
  closedMessage?: string;

  /** Last updated timestamp */
  updatedAt?: Date | { toDate(): Date };

  /** Admin who last updated these settings */
  updatedBy?: string;
}

/**
 * Default settings if document doesn't exist
 */
export const DEFAULT_MEMBERSHIP_SETTINGS: MembershipSettings = {
  registrationOpen: true,
  fullMembershipPrice: 100,
  handicapMembershipPrice: 50,
  closedMessage:
    "Membership registration is currently closed. Please check back later for communication on when registration will open for the year.",
};
