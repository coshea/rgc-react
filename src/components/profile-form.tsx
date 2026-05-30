import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Input,
  Button,
  Spinner,
  TextField,
  Label,
  FieldError,
  Checkbox,
  Modal,
} from "@heroui/react";
import { formatPhone } from "@/utils/phone";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { Icon } from "@iconify/react";
import { saveUserProfile, type UserProfilePayload } from "@/api/users";
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
  defaultGoldTee?: boolean;
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
  // Hide the Cancel button when the user has no existing profile document
  hideCancelWhenNew?: boolean;
  // Provide a stable form id so external buttons (e.g., modal footer) can submit this form
  formId?: string;
  // Optional callback invoked after a successful save (e.g., close modal)
  onSaved?: () => void;
};

export function ProfileForm({
  hideActions = false,
  hideCancelWhenNew = false,
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
    defaultGoldTee: false,
  });

  const [errors, setErrors] = React.useState<FormErrors>({});
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [goldTeeInfoOpen, setGoldTeeInfoOpen] = React.useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userProfile, save, isSaving, saveError, isLoading } =
    useUserProfile();

  // Initialize form data from userProfile hook (simplified single source of truth)
  React.useEffect(() => {
    if (isDirty) return;

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
        defaultGoldTee: profile.defaultGoldTee,
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
        defaultGoldTee: undefined,
      });
      setImagePreview(user.photoURL || null);
    }
  }, [user, userProfile, isLoading, isDirty]);

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
        formData.phone,
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
    setIsDirty(true);
    setFormData((prev) => {
      const next = { ...prev };
      if (field === "phone") {
        next.phone = formatPhone(value);
      } else if (
        field === "firstName" ||
        field === "lastName" ||
        field === "email" ||
        field === "ghinNumber"
      ) {
        next[field] = value;
      }

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
      setIsDirty(true);
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
      const payload: UserProfilePayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName: formData.displayName, // server will recompute anyway
        email: formData.email,
        phone: formData.phone,
        ghinNumber: formData.ghinNumber,
        photoURL: imagePreview || user.photoURL || null,
        ...(formData.defaultGoldTee !== undefined && { defaultGoldTee: formData.defaultGoldTee }),
        // Only include governance fields if current user is admin editing self (admin property on profile)
      };

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
      setIsDirty(false);
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
        <div className="flex justify-center items-center min-h-100">
          <Spinner size="lg" aria-label="Loading profile data..." />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <form
        id={formId || "profile-form"}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="flex flex-col items-center mb-4">
          <div
            className="relative group cursor-pointer mb-2"
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
              className="w-24 h-24 text-lg transition-transform duration-200 group-hover:scale-105 border-2"
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
          <p className="text-muted text-sm">Click to upload profile picture</p>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField
              isRequired
              isInvalid={!!errors.firstName}
              value={formData.firstName}
              onChange={(v) => handleInputChange("firstName")(v)}
            >
              <Label>First Name</Label>
              <Input placeholder="Enter first name" />
              <FieldError>{errors.firstName}</FieldError>
            </TextField>
            <TextField
              isRequired
              isInvalid={!!errors.lastName}
              value={formData.lastName}
              onChange={(v) => handleInputChange("lastName")(v)}
            >
              <Label>Last Name</Label>
              <Input placeholder="Enter last name" />
              <FieldError>{errors.lastName}</FieldError>
            </TextField>
          </div>

          <TextField
            isRequired
            isInvalid={!!errors.email}
            value={formData.email}
            onChange={(v) => handleInputChange("email")(v)}
          >
            <Label>Email</Label>
            <Input placeholder="Enter your email address" type="email" />
            <FieldError>{errors.email}</FieldError>
          </TextField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              isInvalid={!!errors.phone}
              value={formData.phone}
              onChange={(v) => handleInputChange("phone")(v)}
            >
              <Label>Phone Number</Label>
              <Input placeholder="Enter your phone number" type="tel" />
              <FieldError>{errors.phone}</FieldError>
            </TextField>

            <TextField
              isInvalid={!!errors.ghinNumber}
              value={formData.ghinNumber}
              onChange={(v) => handleInputChange("ghinNumber")(v)}
            >
              <Label>GHIN Number</Label>
              <Input placeholder="Enter your GHIN number" type="text" />
              <FieldError>{errors.ghinNumber}</FieldError>
            </TextField>
          </div>

          {/* Gold Tees Default preference */}
          <div className="pt-2 border-t">
            <div className="flex items-start gap-3 rounded-lg border p-4 hover:bg-surface-secondary/50 transition-colors">
              <Checkbox
                isSelected={formData.defaultGoldTee}
                onChange={(v) => {
                  setIsDirty(true);
                  setFormData((prev) => ({ ...prev, defaultGoldTee: v }));
                }}
                aria-label="Default to gold tees"
                className="mt-0.5 shrink-0"
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium min-w-0">
                    <Icon
                      icon="lucide:flag"
                      className="w-4 h-4 text-warning shrink-0"
                    />
                    <span className="truncate">
                      Default to Gold (Senior) Tees
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 h-7 text-xs shrink-0"
                    onPress={() => setGoldTeeInfoOpen(true)}
                    aria-label="Gold tees information"
                  >
                    <Icon icon="lucide:info" className="w-3.5 h-3.5" />
                    Info
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!hideActions && (
          <div className="pt-2">
            <div className="flex items-center justify-between gap-2">
              {!(hideCancelWhenNew && userProfile === null) && (
                <Button
                  type="button"
                  className="w-1/3 h-10 text-sm py-1"
                  onPress={() => navigate(-1)}
                  isDisabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}

              <Button type="submit" className="w-1/3 h-10 text-sm py-1">
                {isSubmitting ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="mt-4 p-3 bg-success text-success-700 rounded-md flex items-center gap-2">
            <Icon icon="lucide:check-circle" />
            <span>Profile updated successfully!</span>
          </div>
        )}
        {saveError && (
          <div className="mt-4 p-3 bg-error-100 text-error-700 rounded-md flex items-center gap-2">
            <Icon icon="lucide:alert-circle" />
            <span>
              There was an error uploading your avatar or saving profile. Please
              try again.
            </span>
          </div>
        )}
      </form>

      <Modal.Backdrop
        isOpen={goldTeeInfoOpen}
        onOpenChange={setGoldTeeInfoOpen}
      >
        <Modal.Container size="sm">
          <Modal.Dialog aria-label="Gold tees setting information">
            <>
              <Modal.Header>Gold Tees Default</Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  This setting is for seniors only. When enabled, you will be
                  pre-selected for gold tees when you register for a tournament
                  or when you are added to a team.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button onPress={() => setGoldTeeInfoOpen(false)}>Close</Button>
              </Modal.Footer>
            </>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Card>
  );
}
