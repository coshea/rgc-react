import React from "react";
import { useNavigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import {
  Card,
  Input,
  Button,
  Spinner,
  TextField,
  Label,
  FieldError,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatPhone } from "@/utils/phone";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { addToast } from "@/providers/toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import { GoldTeeSwitch } from "@/components/profile/gold-tee-switch";
import { ShirtSizePicker } from "@/components/profile/shirt-size-picker";
import {
  profileFieldsFrom,
  toProfilePayload,
  validateProfileFields,
  type ProfileFieldErrors,
  type ProfileFields,
} from "@/components/profile/profile-fields";

type TextFieldKey = "firstName" | "lastName" | "email" | "phone" | "ghinNumber";

type ProfileFormProps = {
  // Hide the internal Cancel/Save action row (useful when embedding in a modal with its own footer)
  hideActions?: boolean;
  // Hide the Cancel button when the user has no existing profile document
  hideCancelWhenNew?: boolean;
  // Provide a stable form id so external buttons (e.g., modal footer) can submit this form
  formId?: string;
  // Optional callback invoked after a successful save (e.g., close modal)
  onSaved?: () => void;
};

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 py-6 first:pt-0 md:flex-row md:gap-8">
      <div className="md:w-56 md:shrink-0">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <Card className="min-w-0 flex-1 p-4 sm:p-5">{children}</Card>
    </section>
  );
}

/**
 * Full profile form, grouped into sections. Used for first-time profile setup
 * on every screen size and for editing on tablet/desktop. Phones edit through
 * `ProfileSettingsList` instead.
 */
export function ProfileForm({
  hideActions = false,
  hideCancelWhenNew = false,
  formId,
  onSaved,
}: ProfileFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userProfile, save, isSaving, saveError, isLoading } =
    useUserProfile();

  const [fields, setFields] = React.useState<ProfileFields>(() =>
    profileFieldsFrom(null, null),
  );
  const [errors, setErrors] = React.useState<ProfileFieldErrors>({});
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [isDirty, setIsDirty] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Hydrate from the stored profile (or auth data) until the user starts editing.
  React.useEffect(() => {
    if (isDirty || !user) return;
    if (userProfile === undefined && isLoading) return;
    setFields(profileFieldsFrom(userProfile, user));
    setImagePreview(userProfile?.photoURL || user.photoURL || null);
  }, [user, userProfile, isLoading, isDirty]);

  const setTextField = (field: TextFieldKey) => (value: string) => {
    setIsDirty(true);
    setFields((prev) => ({
      ...prev,
      [field]: field === "phone" ? formatPhone(value) : value,
    }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsDirty(true);
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validateProfileFields(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      if (!user?.uid) {
        throw new Error("You must be signed in to save your profile");
      }
      await Sentry.startSpan(
        { op: "ui.submit", name: "profile-form.save" },
        () =>
          save({
            data: toProfilePayload(
              fields,
              imagePreview || user.photoURL || null,
            ),
            file: photoFile,
          }),
      );
      setFields((prev) => ({
        ...prev,
        firstName: prev.firstName.trim(),
        lastName: prev.lastName.trim(),
      }));
      setPhotoFile(null);
      setIsDirty(false);
      addToast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
        color: "success",
      });
      onSaved?.();
    } catch (error) {
      // The saveError banner below explains the failure to the user.
      Sentry.captureException(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Spinner size="lg" aria-label="Loading profile data..." />
      </div>
    );
  }

  const displayName =
    [fields.firstName, fields.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    user?.email ||
    "User";
  const showCancel = !(hideCancelWhenNew && userProfile === null);

  return (
    <form
      id={formId || "profile-form"}
      onSubmit={handleSubmit}
      className="flex flex-col text-left"
      noValidate
    >
      <div className="divide-y divide-border">
        <ProfileSection
          title="Photo & name"
          description="How you appear on leaderboards, pairings and the directory."
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <UserAvatar
                  src={imagePreview || undefined}
                  name={displayName}
                  alt={displayName}
                  size="lg"
                  className="h-18 w-18 text-lg"
                />
                {isSaving && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Spinner size="sm" aria-label="Uploading photo" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  variant="secondary"
                  className="h-11"
                  onPress={() => fileInputRef.current?.click()}
                >
                  <Icon icon="lucide:camera" className="h-4 w-4" />
                  Change photo
                </Button>
                <p className="text-xs text-muted">JPG or PNG</p>
              </div>
              {/* Native file input is required to open the OS picker; it is
                  hidden and driven by the accessible HeroUI button above. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleFileChange}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                isRequired
                isInvalid={!!errors.firstName}
                value={fields.firstName}
                onChange={setTextField("firstName")}
              >
                <Label>First name</Label>
                <Input autoComplete="given-name" />
                <FieldError>{errors.firstName}</FieldError>
              </TextField>
              <TextField
                isRequired
                isInvalid={!!errors.lastName}
                value={fields.lastName}
                onChange={setTextField("lastName")}
              >
                <Label>Last name</Label>
                <Input autoComplete="family-name" />
                <FieldError>{errors.lastName}</FieldError>
              </TextField>
            </div>
          </div>
        </ProfileSection>

        <ProfileSection
          title="Contact"
          description="Shown to members in the club directory."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              isRequired
              isInvalid={!!errors.email}
              value={fields.email}
              onChange={setTextField("email")}
            >
              <Label>Email</Label>
              <Input type="email" autoComplete="email" />
              <FieldError>{errors.email}</FieldError>
            </TextField>
            <TextField
              isInvalid={!!errors.phone}
              value={fields.phone}
              onChange={setTextField("phone")}
            >
              <Label>
                Phone <span className="font-normal text-muted">· optional</span>
              </Label>
              <Input type="tel" autoComplete="tel" />
              <FieldError>{errors.phone}</FieldError>
            </TextField>
          </div>
        </ProfileSection>

        <ProfileSection
          title="Golf"
          description="Used for handicaps, registrations and team pairings."
        >
          <div className="flex flex-col gap-4">
            <TextField
              isInvalid={!!errors.ghinNumber}
              value={fields.ghinNumber}
              onChange={setTextField("ghinNumber")}
              className="sm:max-w-xs"
            >
              <Label>
                GHIN number{" "}
                <span className="font-normal text-muted">· optional</span>
              </Label>
              <Input inputMode="numeric" />
              <FieldError>{errors.ghinNumber}</FieldError>
            </TextField>
            <div className="border-t border-border pt-4">
              <GoldTeeSwitch
                isSelected={fields.defaultGoldTee ?? false}
                onChange={(value) => {
                  setIsDirty(true);
                  setFields((prev) => ({ ...prev, defaultGoldTee: value }));
                }}
              />
            </div>
          </div>
        </ProfileSection>

        <ProfileSection
          title="Club apparel"
          description="Only club admins see this. Used for event shirts."
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              T-shirt size <span className="text-danger">*</span>
            </p>
            <ShirtSizePicker
              value={fields.tShirtSize}
              isInvalid={!!errors.tShirtSize}
              onChange={(size) => {
                setIsDirty(true);
                setFields((prev) => ({ ...prev, tShirtSize: size }));
                if (errors.tShirtSize)
                  setErrors((prev) => ({ ...prev, tShirtSize: undefined }));
              }}
            />
            {errors.tShirtSize && (
              <p className="text-sm text-danger" role="alert">
                {errors.tShirtSize}
              </p>
            )}
          </div>
        </ProfileSection>
      </div>

      {saveError && (
        <div
          className="mt-4 flex items-center gap-2 rounded-md bg-danger/10 p-3 text-danger"
          role="alert"
        >
          <Icon icon="lucide:alert-circle" />
          <span>
            There was an error uploading your avatar or saving your profile.
            Please try again.
          </span>
        </div>
      )}

      {!hideActions && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:justify-end sm:px-0">
          {showCancel && (
            <Button
              variant="tertiary"
              className="h-11 flex-1 sm:flex-none"
              onPress={() => navigate(-1)}
              isDisabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            className="h-11 flex-1 sm:flex-none sm:px-6"
            isPending={isSaving}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
