import React from "react";
import {
  Button,
  Drawer,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { formatPhone } from "@/utils/phone";
import { ShirtSizePicker } from "@/components/profile/shirt-size-picker";
import {
  validateProfileFields,
  type ProfileFieldErrors,
  type ProfileFields,
} from "@/components/profile/profile-fields";

export type EditableProfileField =
  | "name"
  | "email"
  | "phone"
  | "ghinNumber"
  | "tShirtSize";

const FIELD_META: Record<
  EditableProfileField,
  { title: string; keys: (keyof ProfileFieldErrors)[]; help: string }
> = {
  name: {
    title: "Name",
    keys: ["firstName", "lastName"],
    help: "Shown on leaderboards, pairings and the member directory.",
  },
  email: {
    title: "Email",
    keys: ["email"],
    help: "Shown to members in the club directory.",
  },
  phone: {
    title: "Phone",
    keys: ["phone"],
    help: "Optional. Shown to members in the club directory.",
  },
  ghinNumber: {
    title: "GHIN number",
    keys: ["ghinNumber"],
    help: "Optional. Used for handicaps.",
  },
  tShirtSize: {
    title: "T-shirt size",
    keys: ["tShirtSize"],
    help: "Only club admins see this. Used for event shirts.",
  },
};

type ProfileFieldSheetProps = {
  /** The field being edited; null closes the sheet. */
  field: EditableProfileField | null;
  fields: ProfileFields;
  isSaving: boolean;
  onClose: () => void;
  onSave: (next: ProfileFields) => Promise<void>;
};

/** Bottom sheet that edits a single profile field (phone layout). */
export function ProfileFieldSheet({
  field,
  fields,
  isSaving,
  onClose,
  onSave,
}: ProfileFieldSheetProps) {
  // The parent remounts this sheet (via `key`) each time a field is opened, so
  // the draft starts from the saved values and a background refetch can't
  // reset it mid-edit.
  const [draft, setDraft] = React.useState<ProfileFields>(fields);
  const [errors, setErrors] = React.useState<ProfileFieldErrors>({});

  const meta = field ? FIELD_META[field] : null;

  const update = (key: keyof ProfileFields) => (value: string) => {
    setDraft((prev) => ({
      ...prev,
      [key]: key === "phone" ? formatPhone(value) : value,
    }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSave = async () => {
    if (!meta) return;
    // Only validate what this sheet edits, so an unrelated legacy gap
    // (e.g. a missing shirt size) never blocks a name change.
    const all = validateProfileFields(draft);
    const relevant: ProfileFieldErrors = {};
    for (const key of meta.keys) if (all[key]) relevant[key] = all[key];
    setErrors(relevant);
    if (Object.keys(relevant).length > 0) return;
    await onSave(draft);
  };

  return (
    <Drawer.Backdrop
      isOpen={field !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Content placement="bottom">
        <Drawer.Dialog aria-label={meta ? `Edit ${meta.title}` : "Edit"}>
          <Drawer.Handle />
          <Drawer.Header>
            <Drawer.Heading>{meta?.title}</Drawer.Heading>
          </Drawer.Header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            noValidate
          >
            <Drawer.Body className="flex flex-col gap-3">
              {field === "name" && (
                <>
                  <TextField
                    isRequired
                    autoFocus
                    isInvalid={!!errors.firstName}
                    value={draft.firstName}
                    onChange={update("firstName")}
                  >
                    <Label>First name</Label>
                    <Input autoComplete="given-name" />
                    <FieldError>{errors.firstName}</FieldError>
                  </TextField>
                  <TextField
                    isRequired
                    isInvalid={!!errors.lastName}
                    value={draft.lastName}
                    onChange={update("lastName")}
                  >
                    <Label>Last name</Label>
                    <Input autoComplete="family-name" />
                    <FieldError>{errors.lastName}</FieldError>
                  </TextField>
                </>
              )}
              {field === "email" && (
                <TextField
                  isRequired
                  autoFocus
                  isInvalid={!!errors.email}
                  value={draft.email}
                  onChange={update("email")}
                >
                  <Label>Email</Label>
                  <Input type="email" autoComplete="email" />
                  <FieldError>{errors.email}</FieldError>
                </TextField>
              )}
              {field === "phone" && (
                <TextField
                  autoFocus
                  isInvalid={!!errors.phone}
                  value={draft.phone}
                  onChange={update("phone")}
                >
                  <Label>Phone</Label>
                  <Input type="tel" autoComplete="tel" />
                  <FieldError>{errors.phone}</FieldError>
                </TextField>
              )}
              {field === "ghinNumber" && (
                <TextField
                  autoFocus
                  isInvalid={!!errors.ghinNumber}
                  value={draft.ghinNumber}
                  onChange={update("ghinNumber")}
                >
                  <Label>GHIN number</Label>
                  <Input inputMode="numeric" />
                  <FieldError>{errors.ghinNumber}</FieldError>
                </TextField>
              )}
              {field === "tShirtSize" && (
                <>
                  <ShirtSizePicker
                    fullWidth
                    value={draft.tShirtSize}
                    isInvalid={!!errors.tShirtSize}
                    onChange={update("tShirtSize")}
                  />
                  {errors.tShirtSize && (
                    <p className="text-sm text-danger" role="alert">
                      {errors.tShirtSize}
                    </p>
                  )}
                </>
              )}
              {meta && <p className="text-sm text-muted">{meta.help}</p>}
            </Drawer.Body>
            <Drawer.Footer className="grid grid-cols-2 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                variant="tertiary"
                className="h-11"
                onPress={onClose}
                isDisabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11" isPending={isSaving}>
                Save
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
