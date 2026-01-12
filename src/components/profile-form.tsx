import React from "react";
import { Card, Input, Button, Spinner, Chip } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { Icon } from "@iconify/react";
import { PiGolf } from "react-icons/pi";
import { saveUserProfile } from "@/api/users";
import { addToast } from "@/providers/toast";
import { useUserProfile } from "@/hooks/useUserProfile";

interface FormData {
  firstName: string;
  lastName: string;
  displayName: string; // derived
  email: string;
  phone: string;
  ghinNumber: string;
  profilePicture: File | null;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  ghinNumber?: string;
}

type ProfileFormProps = {
  // Hide the internal Cancel/Save action row (useful when embedding in a modal with its own footer)
  hideActions?: boolean;
  // Provide a stable form id so external buttons (e.g., modal footer) can submit this form
  formId?: string;
  // Optional callback invoked after a successful save (e.g., close modal)
  onSaved?: () => void;
};

export function ProfileForm({
  hideActions = false,
  formId,
  onSaved,
}: ProfileFormProps) {
  const [formData, setFormData] = React.useState<FormData>({
    firstName: "",
    lastName: "",
    displayName: "",
    email: "",
    phone: "",
    ghinNumber: "",
    profilePicture: null,
  });

  const [errors, setErrors] = React.useState<FormErrors>({});
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const { user } = useAuth();
  const { userProfile, save, isSaving, saveError, isLoading } =
    useUserProfile();

  const membershipTypeChip =
    userProfile?.membershipType === "full"
      ? {
          label: "Full Member",
          color: "success" as const,
          icon: "lucide:badge-check",
        }
      : userProfile?.membershipType === "handicap"
        ? {
            label: "Handicap Only",
            color: "primary" as const,
            icon: "lucide:golf",
          }
        : null;

  // Initialize form data from userProfile hook (simplified single source of truth)
  React.useEffect(() => {
    if (user && userProfile !== undefined) {
      // userProfile can be null (no Firestore doc) or populated
      const profile = userProfile || {};
      setFormData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        displayName: profile.displayName || user.displayName || "",
        email: profile.email || user.email || "",
        phone: profile.phone || user.phoneNumber || "",
        ghinNumber: profile.ghinNumber || "",
        profilePicture: null,
      });
      setImagePreview(profile.photoURL || user.photoURL || null);
    } else if (user && !isLoading) {
      // Fallback to auth user data if no profile exists and not loading
      const nameParts = (user.displayName || "").split(" ");
      setFormData({
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        displayName: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        ghinNumber: "",
        profilePicture: null,
      });
      setImagePreview(user.photoURL || null);
    }
  }, [user, userProfile, isLoading]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (
      formData.phone &&
      !/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(
        formData.phone
      )
    ) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (formData.ghinNumber) {
      if (!/^\d+$/.test(formData.ghinNumber)) {
        newErrors.ghinNumber = "GHIN number must be an integer";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData) => (value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value } as FormData;
      next.displayName = [next.firstName, next.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      return next;
    });

    // Clear error when user types
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    if (file) {
      setFormData((prev) => ({ ...prev, profilePicture: file }));

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user || !user.uid) {
        throw new Error("You must be signed in to save your profile");
      }

      // Debug logging removed to satisfy lint rules and avoid require() in ESM

      // Prepare data to save (do not include File objects)
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName: formData.displayName, // server will recompute anyway
        email: formData.email,
        phone: formData.phone,
        ghinNumber: formData.ghinNumber,
        photoURL: imagePreview || user.photoURL || null,
        // Only include governance fields if current user is admin editing self (admin property on profile)
      } as Record<string, any>;

      // Use the hook's save method (this handles uploading the file if present)
      if (save) {
        await save({ data: payload, file: formData.profilePicture });
      } else {
        await saveUserProfile(user.uid, payload);
      }

      console.log("Profile saved to Firestore for uid:", user.uid);
      // After successful save, normalize (trim) name fields in local state so UI reflects canonical values
      setFormData((prev) => {
        const trimmedFirst = prev.firstName.trim();
        const trimmedLast = prev.lastName.trim();
        return {
          ...prev,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          displayName: [trimmedFirst, trimmedLast]
            .filter(Boolean)
            .join(" ")
            .trim(),
        };
      });
      setIsSuccess(true);

      // Toast feedback
      addToast({
        title: "Profile updated",
        description: "Your profile information has been saved.",
        color: "success",
      });

      // Notify parent (e.g., close modal) on successful save
      try {
        onSaved?.();
      } catch {
        // no-op: parent may not provide a handler
      }

      // Reset success message after 3 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading spinner while fetching profile data
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" label="Loading profile data..." />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form
        id={formId || "profile-form"}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="flex flex-col items-center mb-6">
          <div
            className="relative group cursor-pointer mb-3"
            onClick={triggerFileInput}
          >
            <UserAvatar
              src={imagePreview || undefined}
              name={
                formData.displayName ||
                user?.displayName ||
                user?.email ||
                "User"
              }
              className="w-24 h-24 text-large transition-transform duration-200 group-hover:scale-105 border-2 border-default-200"
              size="lg"
              alt={
                formData.displayName ||
                user?.displayName ||
                user?.email ||
                "User"
              }
            />
            {/* upload spinner overlay when saving */}
            {/** If hook reports saving, show spinner **/}
            {/** eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {/** We check both local isSubmitting and hook saving state in case of differing states **/}
            {(isSubmitting || isSaving) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Icon icon="lucide:camera" className="text-white text-xl" />
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-default-500 text-sm">
            Click to upload profile picture
          </p>

          {membershipTypeChip ? (
            <div className="mt-2 flex justify-center">
              <Chip
                size="sm"
                variant="flat"
                color={membershipTypeChip.color}
                startContent={
                  <Icon icon={membershipTypeChip.icon} className="w-3 h-3" />
                }
              >
                {membershipTypeChip.label}
              </Chip>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              placeholder="Enter first name"
              value={formData.firstName}
              onValueChange={handleInputChange("firstName")}
              isRequired
              isInvalid={!!errors.firstName}
              errorMessage={errors.firstName}
              startContent={
                <Icon icon="lucide:user" className="text-default-400 text-lg" />
              }
            />
            <Input
              label="Last Name"
              placeholder="Enter last name"
              value={formData.lastName}
              onValueChange={handleInputChange("lastName")}
              isRequired
              isInvalid={!!errors.lastName}
              errorMessage={errors.lastName}
              startContent={
                <Icon icon="lucide:user" className="text-default-400 text-lg" />
              }
            />
          </div>

          <Input
            label="Email"
            placeholder="Enter your email address"
            value={formData.email}
            onValueChange={handleInputChange("email")}
            type="email"
            isRequired
            isInvalid={!!errors.email}
            errorMessage={errors.email}
            startContent={
              <Icon icon="lucide:mail" className="text-default-400 text-lg" />
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              placeholder="Enter your phone number"
              value={formData.phone}
              onValueChange={handleInputChange("phone")}
              type="tel"
              isInvalid={!!errors.phone}
              errorMessage={errors.phone}
              startContent={
                <Icon
                  icon="lucide:phone"
                  className="text-default-400 text-lg"
                />
              }
            />

            <Input
              label="GHIN Number"
              placeholder="Enter your GHIN number"
              value={formData.ghinNumber}
              onValueChange={handleInputChange("ghinNumber")}
              type="text"
              isInvalid={!!errors.ghinNumber}
              errorMessage={errors.ghinNumber}
              startContent={<PiGolf className="text-default-400 text-lg" />}
            />
          </div>
        </div>

        {!hideActions && (
          <div className="pt-2">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                className="w-1/3 h-10 text-sm py-1"
                onClick={() => window.history.back()}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                color="primary"
                className="w-1/3 h-10 text-sm py-1"
                isLoading={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="mt-4 p-3 bg-success-100 text-success-700 rounded-medium flex items-center gap-2">
            <Icon icon="lucide:check-circle" />
            <span>Profile updated successfully!</span>
          </div>
        )}
        {saveError && (
          <div className="mt-4 p-3 bg-error-100 text-error-700 rounded-medium flex items-center gap-2">
            <Icon icon="lucide:alert-circle" />
            <span>
              There was an error uploading your avatar or saving profile. Please
              try again.
            </span>
          </div>
        )}
      </form>
    </Card>
  );
}
