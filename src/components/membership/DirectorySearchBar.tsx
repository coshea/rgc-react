import { SearchInput } from "@/components/search-input";
import { Switch } from "@heroui/react";

interface DirectorySearchBarProps {
  filter: string;
  onFilterChange: (v: string) => void;
  // count = number of items currently shown (after filtering)
  count: number;
  // total = total available items before filtering (optional)
  total?: number;
  isAdmin?: boolean;
  activeOnly?: boolean;
  onActiveOnlyChange?: (v: boolean) => void;
}

export function DirectorySearchBar({
  filter,
  onFilterChange,
  count,
  isAdmin,
  activeOnly,
  onActiveOnlyChange,
  // total, // if needed in future
}: DirectorySearchBarProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
        <SearchInput
          value={filter}
          onChange={onFilterChange}
          placeholder="Search for a user..."
          ariaLabel="Search members"
          className="sm:max-w-sm"
          onClear={() => onFilterChange("")}
        />
        {isAdmin && onActiveOnlyChange && (
          <Switch
            size="sm"
            isSelected={activeOnly}
            onChange={onActiveOnlyChange}
            aria-label="Toggle active members only"
            className="whitespace-nowrap"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Active Last 2 Years
            </Switch.Content>
          </Switch>
        )}
      </div>
      <div className="text-xs text-muted">
        Showing {count} member{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}
