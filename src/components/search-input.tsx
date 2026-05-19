import React from "react";
import { SearchField } from "@heroui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  autoFocus?: boolean;
  onClear?: () => void;
  // Additional Input props passthrough (typed loosely to avoid tight coupling)
  disabled?: boolean;
}

/**
 * Shared search input styling used across directory & leaderboard views.
 * Standardizes:
 * - Magnifying glass icon (consistent size & color)
 * - Clearable behavior
 * - Small size by default for dense list toolbars
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "Search",
  className,
  autoFocus,
  onClear,
  disabled,
}) => {
  return (
    <SearchField
      value={value}
      onChange={(v) => onChange(v)}
      onClear={() => (onClear ? onClear() : onChange(""))}
      isDisabled={disabled}
      aria-label={ariaLabel}
      className={clsx("search-input", className)}
    >
      <SearchField.Group>
        <SearchField.SearchIcon>
          <MagnifyingGlassIcon className="w-4 h-4 text-muted" />
        </SearchField.SearchIcon>
        <SearchField.Input placeholder={placeholder} autoFocus={autoFocus} />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
};

export default SearchInput;
