import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { User } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";
import { UserSelect } from "@/components/UserSelect";

interface RegistrationEditorProps {
  value: string[]; // array of user ids
  onChange: (ids: string[]) => void;
  users: User[];
  maxSize: number;
  labels?: { leader?: string; teammate?: (index: number) => string };
  /** When true, do not auto-select the current authenticated user into the first slot. Useful for admin flows. */
  disableAutoSelect?: boolean;
}

export const RegistrationEditor: React.FC<RegistrationEditorProps> = ({
  value,
  onChange,
  users,
  maxSize,
  labels,
  disableAutoSelect,
}) => {
  const ids = value || [];

  // useAuth throws when not used within provider; guard for test environments
  let authUser: { uid?: string } | null | undefined;
  try {
    // eslint-disable-next-line prefer-const
    const auth = useAuth();
    authUser = auth?.user;
  } catch (e) {
    // No AuthProvider available (e.g., unit tests). Continue without auto-fill.
    authUser = undefined;
  }

  // Build a fast lookup set for valid user ids
  const validUserIds = React.useMemo(
    () => new Set(users.map((u) => u.id)),
    [users]
  );

  // Effect: whenever the users list changes, drop any stale ids that no longer exist
  React.useEffect(() => {
    if (!ids.length) return;
    const filtered = ids.filter((id) => id && validUserIds.has(id));
    if (filtered.length !== ids.length) {
      onChange(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Auto-select the current authenticated user as the first player when registering
  // This can be disabled by passing disableAutoSelect=true (useful for admin-only flows).
  React.useEffect(() => {
    if (disableAutoSelect) return;
    const uid = authUser?.uid;
    if (!uid) return;

    // Only set when there are no ids yet, or the first slot is empty
    if (ids.length === 0) {
      if (validUserIds.has(uid)) {
        onChange([uid]);
      }
      return;
    }

    if (!ids[0] && validUserIds.has(uid)) {
      const next = [...ids];
      next[0] = uid;
      onChange(next);
    }
    // We intentionally depend on authUser.uid and users (validUserIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid, users, disableAutoSelect]);

  const updateIdx = (index: number, newId: string | undefined) => {
    const next = [...ids];
    next[index] = newId || "";
    onChange(next);
  };

  const addSlot = () => {
    if (ids.length >= maxSize) return;
    onChange([...ids, ""]);
  };

  const removeSlot = (index: number) => {
    const next = ids.slice();
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {ids.map((uid, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <div className="flex-1">
            <UserSelect
              users={users}
              label={
                idx === 0
                  ? labels?.leader || "Team Leader"
                  : labels?.teammate?.(idx) || `Teammate ${idx + 1}`
              }
              value={uid || ""}
              onChange={(v) => updateIdx(idx, (v as string) || undefined)}
              multiple={false}
              showRemovedHint
              className="w-full"
            />
          </div>
          {ids.length > 1 && (
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={() => removeSlot(idx)}
            >
              <Icon icon="lucide:trash-2" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="flat"
          onPress={addSlot}
          isDisabled={ids.length >= maxSize}
        >
          Add Teammate
        </Button>
        <div className="text-sm text-foreground-500">
          {ids.length}/{maxSize}
        </div>
      </div>
    </div>
  );
};

export default RegistrationEditor;
