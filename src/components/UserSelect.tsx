import React from "react";
import {
  ComboBox,
  EmptyState,
  Input,
  Label,
  ListBox,
  useFilter,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import type { User } from "@/api/users";

export interface UserSelectProps {
  users: User[];
  label?: string;
  placeholder?: string;
  value: string | string[]; // controlled
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  maxSelected?: number; // clamp selection length when multiple
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  allowCustomValue?: boolean; // default false (unused with Autocomplete, kept for API compat)
  className?: string;
  /** When true and the current value references a missing user id, render a small hint below. */
  showRemovedHint?: boolean;
}

function displayFor(u: User) {
  return u.displayName || u.email || u.id;
}

export const UserSelect: React.FC<UserSelectProps> = ({
  users,
  label,
  placeholder = "Search users",
  value,
  onChange,
  multiple,
  maxSelected,
  disabled,
  required,
  invalid,
  errorMessage,
  allowCustomValue,
  className,
  showRemovedHint,
}) => {
  const { contains } = useFilter({ sensitivity: "base" });

  // Alphabetical sort by displayName/email (case-insensitive)
  const sortedUsers = React.useMemo(() => {
    const list = [...(users || [])];
    list.sort((a, b) => {
      const A = (a.displayName || a.email || a.id || "").toLowerCase();
      const B = (b.displayName || b.email || b.id || "").toLowerCase();
      if (A < B) return -1;
      if (A > B) return 1;
      return 0;
    });
    return list;
  }, [users]);

  const idSet = React.useMemo(
    () => new Set(sortedUsers.map((u) => u.id)),
    [sortedUsers],
  );

  const renderRemovedHint = () => {
    if (!showRemovedHint || !value) {
      return null;
    }

    const hasMissingId = Array.isArray(value)
      ? value.some((v) => v && !idSet.has(v))
      : value && !idSet.has(value);

    if (hasMissingId) {
      return <div className="mt-1 text-danger text-sm">Removed User</div>;
    }

    return null;
  };

  if (multiple) {
    // Multiple selection mode: use ComboBox's native multi-select support.
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const selectedValues = selected.filter(
      (id, index, all) => Boolean(id) && all.indexOf(id) === index,
    );
    const selectedSet = new Set(selectedValues);
    const canAddMore = !(
      typeof maxSelected === "number" &&
      maxSelected > 0 &&
      selectedValues.length >= maxSelected
    );
    const disabledKeys = canAddMore
      ? undefined
      : sortedUsers.filter((u) => !selectedSet.has(u.id)).map((u) => u.id);

    const setUsers = (keys: Key | null | Key[]) => {
      if (!Array.isArray(keys)) {
        return;
      }

      const nextSelected = keys
        .map((key) => String(key))
        .filter((id, index, all) => all.indexOf(id) === index);

      if (
        typeof maxSelected === "number" &&
        maxSelected > 0 &&
        nextSelected.length > maxSelected
      ) {
        return;
      }

      onChange(nextSelected);
    };

    return (
      <div className={className}>
        <ComboBox
          selectionMode="multiple"
          value={selectedValues}
          onChange={setUsers}
          disabledKeys={disabledKeys}
          defaultFilter={contains}
          isDisabled={disabled}
          isRequired={required}
          isInvalid={invalid}
          allowsCustomValue={allowCustomValue}
          fullWidth
        >
          {label && <Label>{label}</Label>}
          <ComboBox.InputGroup>
            <Input placeholder={placeholder} />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Value placeholder="No users selected" />
          <ComboBox.Popover>
            <ListBox
              selectionMode="multiple"
              renderEmptyState={() => <EmptyState>No users found</EmptyState>}
            >
              {sortedUsers.map((u) => (
                <ListBox.Item key={u.id} id={u.id} textValue={displayFor(u)}>
                  {displayFor(u)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        {errorMessage && (
          <div className="mt-1 text-danger text-sm">{errorMessage}</div>
        )}
        {renderRemovedHint()}
      </div>
    );
  }

  // Single selection mode
  const selectedKey = !Array.isArray(value) && value ? (value as string) : null;

  return (
    <div className={className}>
      <ComboBox
        selectionMode="single"
        value={selectedKey}
        onChange={(key) => onChange(key ? String(key) : "")}
        defaultFilter={contains}
        isDisabled={disabled}
        isRequired={required}
        isInvalid={invalid}
        allowsCustomValue={allowCustomValue}
        fullWidth
      >
        {label && <Label>{label}</Label>}
        <ComboBox.InputGroup>
          <Input placeholder={placeholder} />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() => <EmptyState>No users found</EmptyState>}
          >
            {sortedUsers.map((u) => (
              <ListBox.Item key={u.id} id={u.id} textValue={displayFor(u)}>
                {displayFor(u)}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
        {errorMessage && (
          <div className="mt-1 text-danger text-sm">{errorMessage}</div>
        )}
      </ComboBox>
      {renderRemovedHint()}
    </div>
  );
};

export default UserSelect;
