import {
  T_SHIRT_SIZES,
  type TShirtSize,
  type UserProfilePayload,
} from "@/api/users";

/** Editable fields shared by the profile form (desktop) and settings list (phone). */
export interface ProfileFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ghinNumber: string;
  tShirtSize: string;
  /** undefined = the member has never set a preference. */
  defaultGoldTee?: boolean;
}

export type ProfileFieldErrors = Partial<
  Record<
    "firstName" | "lastName" | "email" | "phone" | "ghinNumber" | "tShirtSize",
    string
  >
>;

/** The subset of the Firebase auth user used to prefill a missing profile. */
export interface ProfileAuthUser {
  displayName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  photoURL?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

export function isTShirtSize(value: string): value is TShirtSize {
  return (T_SHIRT_SIZES as readonly string[]).includes(value);
}

export function validateProfileFields(
  fields: ProfileFields,
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (!fields.firstName.trim()) errors.firstName = "First name is required";
  if (!fields.lastName.trim()) errors.lastName = "Last name is required";

  if (!fields.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(fields.email)) {
    errors.email = "Please enter a valid email address";
  }

  if (fields.phone && !PHONE_RE.test(fields.phone)) {
    errors.phone = "Please enter a valid phone number";
  }

  if (fields.ghinNumber && !/^\d+$/.test(fields.ghinNumber)) {
    errors.ghinNumber = "GHIN number must be an integer";
  }

  if (!fields.tShirtSize) {
    errors.tShirtSize = "T-shirt size is required";
  } else if (!isTShirtSize(fields.tShirtSize)) {
    errors.tShirtSize = "Please select a valid T-shirt size";
  }

  return errors;
}

/** Build editable fields from the stored profile, falling back to auth data. */
export function profileFieldsFrom(
  profile: UserProfilePayload | null | undefined,
  authUser: ProfileAuthUser | null | undefined,
): ProfileFields {
  if (profile) {
    return {
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      email: profile.email || authUser?.email || "",
      phone: profile.phone || authUser?.phoneNumber || "",
      ghinNumber: profile.ghinNumber || "",
      tShirtSize: profile.tShirtSize || "",
      defaultGoldTee: profile.defaultGoldTee,
    };
  }

  const nameParts = (authUser?.displayName || "").split(" ");
  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" ") || "",
    email: authUser?.email || "",
    phone: authUser?.phoneNumber || "",
    ghinNumber: "",
    tShirtSize: "",
    defaultGoldTee: undefined,
  };
}

/** Convert edited fields to the payload `useUserProfile().save` expects. */
export function toProfilePayload(
  fields: ProfileFields,
  photoURL: string | null,
): UserProfilePayload {
  const firstName = fields.firstName.trim();
  const lastName = fields.lastName.trim();
  return {
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(" "),
    email: fields.email.trim(),
    phone: fields.phone,
    ghinNumber: fields.ghinNumber,
    ...(isTShirtSize(fields.tShirtSize) && { tShirtSize: fields.tShirtSize }),
    photoURL,
    ...(typeof fields.defaultGoldTee === "boolean" && {
      defaultGoldTee: fields.defaultGoldTee,
    }),
  };
}
