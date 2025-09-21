import React from "react";
import { Select, SelectItem, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { User } from "@/api/users";

interface RegistrationEditorProps {
  value: string[]; // array of user ids
  onChange: (ids: string[]) => void;
  users: User[];
  maxSize: number;
  labels?: { leader?: string; teammate?: (index: number) => string };
}

export const RegistrationEditor: React.FC<RegistrationEditorProps> = ({
  value,
  onChange,
  users,
  maxSize,
  labels,
}) => {
  const ids = value || [];

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
            <Select
              label={
                idx === 0
                  ? labels?.leader || "Team Leader"
                  : labels?.teammate?.(idx) || `Teammate ${idx + 1}`
              }
              placeholder="Select user"
              selectionMode="single"
              // Only pass currently valid uid to avoid HeroUI warning about missing keys
              selectedKeys={
                uid && validUserIds.has(uid) ? new Set([uid]) : new Set()
              }
              onSelectionChange={(keys) => {
                const selected = Array.from(keys as Set<string>)[0];
                updateIdx(idx, selected);
              }}
              className="w-full"
            >
              {(() => {
                const items: React.ReactElement[] = [];
                if (uid && !validUserIds.has(uid)) {
                  items.push(
                    <SelectItem
                      key={uid}
                      className="text-danger"
                      textValue="Removed User"
                    >
                      Removed User
                    </SelectItem>
                  );
                }
                for (const u of users) {
                  items.push(
                    <SelectItem key={u.id}>
                      {u.displayName || u.email || u.id}
                    </SelectItem>
                  );
                }
                return items;
              })()}
            </Select>
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
