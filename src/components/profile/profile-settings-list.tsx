import React from "react";
import { useNavigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { Button, Card, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { addToast } from "@/providers/toast";
import { siteConfig } from "@/config/site";
import { formatPhone } from "@/utils/phone";
import { GoldTeeSwitch } from "@/components/profile/gold-tee-switch";
import {
  ProfileFieldSheet,
  type EditableProfileField,
} from "@/components/profile/profile-field-sheet";
import {
  profileFieldsFrom,
  toProfilePayload,
  type ProfileFields,
} from "@/components/profile/profile-fields";

type Row = {
  field: EditableProfileField;
  label: string;
  value: string;
  missing?: boolean;
};

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <Card className="divide-y divide-border overflow-hidden p-0">
        {children}
      </Card>
    </section>
  );
}

function SettingsRow({
  label,
  value,
  missing,
  onPress,
}: {
  label: string;
  value: string;
  missing?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      variant="ghost"
      fullWidth
      onPress={onPress}
      className="h-auto min-h-13 justify-between gap-3 rounded-none px-4 font-normal"
    >
      <span className="shrink-0 text-foreground">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-right ${missing ? "text-danger" : "text-muted"}`}
      >
        {value}
      </span>
      <Icon
        icon="lucide:chevron-right"
        className="h-4 w-4 shrink-0 text-muted"
        aria-hidden="true"
      />
    </Button>
  );
}

/**
 * Phone profile editor: a settings-style list where each row opens a bottom
 * sheet for that one field and saves on its own.
 */
export function ProfileSettingsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userProfile, save, isSaving, isLoading } = useUserProfile();
  const [openField, setOpenField] =
    React.useState<EditableProfileField | null>(null);
  // Bumped on every open so the sheet remounts with fresh values.
  const [sheetKey, setSheetKey] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fields = React.useMemo(
    () => profileFieldsFrom(userProfile, user),
    [userProfile, user],
  );
  const photoURL = userProfile?.photoURL || user?.photoURL || null;

  const persist = async (
    next: ProfileFields,
    opts: { file?: File; successTitle: string },
  ) => {
    try {
      await Sentry.startSpan(
        { op: "ui.submit", name: "profile-settings.save" },
        () =>
          save({ data: toProfilePayload(next, photoURL), file: opts.file }),
      );
      addToast({
        title: opts.successTitle,
        description: "Your profile has been saved.",
        color: "success",
      });
      return true;
    } catch (error) {
      Sentry.captureException(error);
      addToast({
        title: "Couldn't save",
        description: "Please try again.",
        color: "danger",
      });
      return false;
    }
  };

  const openSheet = (field: EditableProfileField) => {
    setSheetKey((k) => k + 1);
    setOpenField(field);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <Spinner size="lg" aria-label="Loading profile data..." />
      </div>
    );
  }

  const name = [fields.firstName, fields.lastName].filter(Boolean).join(" ");
  const notSet = "Not set";
  const aboutRows: Row[] = [
    { field: "name", label: "Name", value: name || notSet, missing: !name },
    {
      field: "email",
      label: "Email",
      value: fields.email || notSet,
      missing: !fields.email,
    },
    {
      field: "phone",
      label: "Phone",
      value: fields.phone ? formatPhone(fields.phone) : notSet,
    },
  ];
  const golfRows: Row[] = [
    { field: "ghinNumber", label: "GHIN number", value: fields.ghinNumber || notSet },
    {
      field: "tShirtSize",
      label: "T-shirt size",
      value: fields.tShirtSize || "Required",
      missing: !fields.tShirtSize,
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <UserAvatar
            src={photoURL || undefined}
            name={name || user?.email || "User"}
            size="lg"
            className="h-21 w-21 text-xl"
          />
          {isSaving && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Spinner size="sm" aria-label="Saving" />
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className="h-11"
          onPress={() => fileInputRef.current?.click()}
          isDisabled={isSaving}
        >
          Change photo
        </Button>
        {/* Native file input is required to open the OS picker; it is hidden
            and driven by the accessible HeroUI button above. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void persist(fields, { file, successTitle: "Photo updated" });
          }}
        />
      </div>

      <SettingsGroup title="About you">
        {aboutRows.map((row) => (
          <SettingsRow
            key={row.field}
            label={row.label}
            value={row.value}
            missing={row.missing}
            onPress={() => openSheet(row.field)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Golf">
        {golfRows.map((row) => (
          <SettingsRow
            key={row.field}
            label={row.label}
            value={row.value}
            missing={row.missing}
            onPress={() => openSheet(row.field)}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <div className="px-4 py-3">
          <GoldTeeSwitch
            isSelected={fields.defaultGoldTee ?? false}
            isDisabled={isSaving}
            onChange={(value) =>
              void persist(
                { ...fields, defaultGoldTee: value },
                { successTitle: value ? "Gold tees on" : "Gold tees off" },
              )
            }
          />
        </div>
        <Button
          variant="ghost"
          fullWidth
          onPress={() => navigate(siteConfig.pages.notificationSettings.link)}
          className="h-auto min-h-13 justify-between rounded-none px-4 font-normal"
        >
          <span className="text-foreground">Notifications</span>
          <Icon
            icon="lucide:chevron-right"
            className="h-4 w-4 text-muted"
            aria-hidden="true"
          />
        </Button>
      </SettingsGroup>

      <ProfileFieldSheet
        key={sheetKey}
        field={openField}
        fields={fields}
        isSaving={isSaving}
        onClose={() => setOpenField(null)}
        onSave={async (next) => {
          const label = openField === "tShirtSize" ? "Size" : "Profile";
          if (await persist(next, { successTitle: `${label} updated` })) {
            setOpenField(null);
          }
        }}
      />
    </div>
  );
}
