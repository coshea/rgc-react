import React from "react";
import { Autocomplete, AutocompleteItem, Button } from "@heroui/react";
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
  allowCustomValue?: boolean; // default false
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
  allowCustomValue = false,
  className,
  showRemovedHint,
}) => {
  // Hook must be unconditional (even though it's only used in multiple mode)
  const [inputValue, setInputValue] = React.useState("");

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
    [sortedUsers]
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
    // Multiple selection mode with autocomplete + selected list
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const selectedSet = new Set(selected);
    const remainingUsers = sortedUsers.filter((u) => !selectedSet.has(u.id));
    const canAddMore = !(
      typeof maxSelected === "number" &&
      maxSelected > 0 &&
      selected.length >= maxSelected
    );
    const lowered = inputValue.trim().toLowerCase();
    const filteredRemaining = lowered
      ? remainingUsers.filter((u) => {
          const text = (u.displayName || u.email || u.id || "").toLowerCase();
          return text.includes(lowered);
        })
      : remainingUsers;

    const addUser = (id: string | null) => {
      if (!id) return;
      if (selectedSet.has(id)) return;
      if (!canAddMore) return;
      onChange([...selected, id]);
      setInputValue("");
    };

    const removeUser = (id: string) => {
      onChange(selected.filter((v) => v !== id));
    };

    return (
      <div className={className}>
        <Autocomplete
          label={label}
          placeholder={placeholder}
          inputProps={{
            classNames: {
              input: "text-base",
            },
          }}
          isDisabled={disabled || !canAddMore}
          isRequired={required}
          isInvalid={invalid}
          errorMessage={errorMessage}
          menuTrigger="input"
          allowsCustomValue={false}
          inputValue={inputValue}
          onInputChange={setInputValue}
          items={filteredRemaining}
          onSelectionChange={(key) => addUser(key as string)}
        >
          {(u: User) => (
            <AutocompleteItem key={u.id} textValue={displayFor(u)}>
              {displayFor(u)}
            </AutocompleteItem>
          )}
        </Autocomplete>
        {/* Selected list */}
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.map((id) => {
              const u = sortedUsers.find((x) => x.id === id);
              const labelText = u ? displayFor(u) : id;
              return (
                <div
                  key={id}
                  className="inline-flex items-center gap-1 bg-content2 rounded-full px-2 py-1 text-sm"
                >
                  <span className="truncate max-w-[200px]">{labelText}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
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
        label={label}
        placeholder={placeholder}
        inputProps={{
          classNames: {
            input: "text-base",
          },
        }}
        selectedKey={selectedKey}
        onSelectionChange={(key) => {
          onChange(((key as string) || "") as string);
        }}
        isDisabled={disabled}
        isRequired={required}
        isInvalid={invalid}
        errorMessage={errorMessage}
        menuTrigger="input"
        allowsCustomValue={allowCustomValue}
        defaultItems={sortedUsers}
      >
        {(u: User) => (
          <AutocompleteItem key={u.id} textValue={displayFor(u)}>
            {displayFor(u)}
          </AutocompleteItem>
        )}
      </Autocomplete>
      {renderRemovedHint()}
    </div>
  );
};

export default UserSelect;
