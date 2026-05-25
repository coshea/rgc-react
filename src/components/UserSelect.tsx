import React from "react";
import {
  Autocomplete,
  Button,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  useFilter,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { Icon } from "@iconify/react";
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
    // Multiple selection mode: single-add autocomplete + external chip list
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const selectedSet = new Set(selected);
    const availableUsers = sortedUsers.filter((u) => !selectedSet.has(u.id));
    const canAddMore = !(
      typeof maxSelected === "number" &&
      maxSelected > 0 &&
      selected.length >= maxSelected
    );

    const addUser = (key: Key | null) => {
      if (!key) return;
      const id = key as string;
      if (selectedSet.has(id) || !canAddMore) return;
      onChange([...selected, id]);
    };

    const removeUser = (id: string) => {
      onChange(selected.filter((v) => v !== id));
    };

    return (
      <div className={className}>
        <Autocomplete
          selectionMode="single"
          placeholder={placeholder}
          isDisabled={disabled || !canAddMore}
          isRequired={required}
          isInvalid={invalid}
          // Keep value null so the trigger always resets to placeholder after each pick
          value={null}
          onChange={addUser}
          fullWidth
        >
          {label && <Label>{label}</Label>}
          <Autocomplete.Trigger>
            <Autocomplete.Value />
            <Autocomplete.Indicator />
          </Autocomplete.Trigger>
          <Autocomplete.Popover>
            <Autocomplete.Filter filter={contains}>
              <SearchField autoFocus name="user-search" variant="secondary">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Search..." />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <ListBox
                renderEmptyState={() => <EmptyState>No users found</EmptyState>}
              >
                {availableUsers.map((u) => (
                  <ListBox.Item key={u.id} id={u.id} textValue={displayFor(u)}>
                    {displayFor(u)}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Autocomplete.Filter>
          </Autocomplete.Popover>
        </Autocomplete>
        {errorMessage && (
          <div className="mt-1 text-danger text-sm">{errorMessage}</div>
        )}
        {/* Selected list */}
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.map((id) => {
              const u = sortedUsers.find((x) => x.id === id);
              const labelText = u ? displayFor(u) : id;
              return (
                <div
                  key={id}
                  className="inline-flex items-center gap-1 bg-surface-secondary rounded-full px-2 py-1 text-sm"
                >
                  <span className="truncate max-w-[200px]">{labelText}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${labelText}`}
                    onPress={() => removeUser(id)}
                  >
                    <Icon icon="lucide:x" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {renderRemovedHint()}
      </div>
    );
  }

  // Single selection mode
  const selectedKey =
    !Array.isArray(value) && value && idSet.has(value)
      ? (value as string)
      : null;

  return (
    <div className={className}>
      <Autocomplete
        selectionMode="single"
        placeholder={placeholder}
        isDisabled={disabled}
        isRequired={required}
        isInvalid={invalid}
        value={selectedKey}
        onChange={(key) => onChange(((key as string) ?? "") as string)}
        fullWidth
      >
        {label && <Label>{label}</Label>}
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.ClearButton />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus name="user-search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
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
          </Autocomplete.Filter>
        </Autocomplete.Popover>
        {errorMessage && (
          <div className="mt-1 text-danger text-sm">{errorMessage}</div>
        )}
      </Autocomplete>
      {renderRemovedHint()}
    </div>
  );
};

export default UserSelect;
