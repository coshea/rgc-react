import React from "react";
import { Button, Tooltip } from "@heroui/react";
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
  /** When true, disable all inputs and controls inside the editor (used to block ineligible users). */
  disabled?: boolean;
  /** Array of user IDs that should play from the gold (senior) tees. */
  goldTees?: string[];
  /** Called when the gold tee selection changes. When omitted, the gold tee toggle is hidden. */
  onGoldTeesChange?: (ids: string[]) => void;
}

export const RegistrationEditor: React.FC<RegistrationEditorProps> = ({
  value,
  onChange,
  users,
  maxSize,
  labels,
  disableAutoSelect,
  disabled = false,
  goldTees,
  onGoldTeesChange,
}) => {
  const ids = value || [];

  // useAuth throws when not used within provider; guard for test environments
  // useAuth may return undefined if AuthProvider is missing (e.g., unit tests)
  const auth = useAuth();
  const authUser: { uid?: string } | null | undefined = auth?.user;

  // Build a fast lookup set for valid user ids
  const validUserIds = React.useMemo(
    () => new Set(users.map((u) => u.id)),
    [users],
  );

  // Effect: whenever the users list changes, drop any stale ids that no longer exist
  React.useEffect(() => {
    if (!ids.length) return;
    // Preserve empty placeholder slots (""), but clear any non-empty ids that are no longer valid.
    const cleaned = ids.map((id) => (id && validUserIds.has(id) ? id : ""));
    if (cleaned.some((id, i) => id !== ids[i])) {
      onChange(cleaned);
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
              disabled={disabled}
            />
          </div>
          {onGoldTeesChange && uid && (
            <Tooltip
              content="Playing from the gold (senior) tees"
              placement="top"
              closeDelay={0}
            >
              <Button
                size="sm"
                variant={goldTees?.includes(uid) ? "flat" : "light"}
                color={goldTees?.includes(uid) ? "warning" : "default"}
                onPress={() => {
                  const isGold = goldTees?.includes(uid) ?? false;
                  const next = isGold
                    ? (goldTees ?? []).filter((id) => id !== uid)
                    : [...(goldTees ?? []), uid];
                  onGoldTeesChange(next);
                }}
                isDisabled={disabled}
                aria-label={`${
                  goldTees?.includes(uid) ? "Remove" : "Add"
                } gold tees: ${
                  idx === 0 ? "team leader" : `teammate ${idx + 1}`
                }`}
                className="shrink-0"
                startContent={<Icon icon="lucide:flag" className="text-sm" />}
              >
                Gold
              </Button>
            </Tooltip>
          )}
          {ids.length > 1 && (
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={() => removeSlot(idx)}
              aria-label={
                idx === 0 ? "Remove team leader" : `Remove teammate ${idx + 1}`
              }
              isDisabled={disabled}
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
          isDisabled={disabled || ids.length >= maxSize}
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
