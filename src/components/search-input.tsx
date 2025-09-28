import React from "react";
import { Input } from "@heroui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  radius?: "full" | "sm" | "md" | "lg" | "none";
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
 * - Rounded full radius by default
 * - Small size by default for dense list toolbars
 */
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "Search",
  className,
  size = "sm",
  radius = "full",
  autoFocus,
  onClear,
  disabled,
}) => {
  return (
    <Input
      isClearable
      size={size}
      radius={radius}
      startContent={
        <MagnifyingGlassIcon className="w-4 h-4 text-default-400" />
      }
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      onValueChange={onChange}
      onClear={() => (onClear ? onClear() : onChange(""))}
      className={clsx("search-input", className)}
      autoFocus={autoFocus}
      isDisabled={disabled}
    />
  );
};

export default SearchInput;
