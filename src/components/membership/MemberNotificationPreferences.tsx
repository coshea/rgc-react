import { Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { NotificationPreferences } from "@/api/users";

type PrefKey = keyof NotificationPreferences;

/** Same categories, in the same order, as the member's notification settings page. */
const CATEGORIES: ReadonlyArray<{
  label: string;
  push: PrefKey;
  email: PrefKey;
}> = [
  {
    label: "Tournament registration",
    push: "tournamentRegistration",
    email: "emailTournamentRegistration",
  },
  {
    label: "Tournament updates",
    push: "tournamentUpdates",
    email: "emailTournamentUpdates",
  },
  {
    label: "Announcements",
    push: "generalAnnouncements",
    email: "emailGeneralAnnouncements",
  },
  { label: "New features", push: "newFeatures", email: "emailNewFeatures" },
];

interface MemberNotificationPreferencesProps {
  value: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
  isDisabled?: boolean;
}

function PrefSwitch({
  isSelected,
  onChange,
  isDisabled,
  label,
}: {
  isSelected: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
  label: string;
}) {
  return (
    <Switch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      aria-label={label}
    >
      {/* Switch.Content renders the real input; the control must sit inside it. */}
      <Switch.Content>
        <Switch.Control className="shrink-0">
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

/**
 * Admin view of a member's push and email preferences, e.g. to honor an
 * unsubscribe request that arrived by email or phone.
 */
export function MemberNotificationPreferences({
  value,
  onChange,
  isDisabled,
}: MemberNotificationPreferencesProps) {
  const set = (key: PrefKey, next: boolean) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 pb-0.5">
        <div className="flex-1" />
        <div className="flex w-14 items-center justify-center gap-1 text-xs font-medium text-muted">
          <Icon icon="lucide:bell" className="text-sm" />
          Push
        </div>
        <div className="flex w-14 items-center justify-center gap-1 text-xs font-medium text-muted">
          <Icon icon="lucide:mail" className="text-sm" />
          Email
        </div>
      </div>
      {CATEGORIES.map(({ label, push, email }) => (
        <div key={label} className="flex min-h-11 items-center gap-2">
          <p className="min-w-0 flex-1 text-sm">{label}</p>
          <div className="flex w-14 justify-center">
            <PrefSwitch
              isSelected={value[push]}
              onChange={(v) => set(push, v)}
              isDisabled={isDisabled}
              label={`Push: ${label}`}
            />
          </div>
          <div className="flex w-14 justify-center">
            <PrefSwitch
              isSelected={value[email]}
              onChange={(v) => set(email, v)}
              isDisabled={isDisabled}
              label={`Email: ${label}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
