import { ToggleButton, ToggleButtonGroup } from "@heroui/react";

import { SearchInput } from "@/components/search-input";
import {
  DIRECTORY_FILTER,
  type DirectoryFilter,
  isDirectoryFilter,
} from "@/utils/memberDirectory";

interface DirectoryFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  filter: DirectoryFilter;
  onFilterChange: (f: DirectoryFilter) => void;
  /** Admins can narrow to members who paid in the last two years. */
  showActiveFilter: boolean;
}

const chip = "h-11 shrink-0 rounded-full px-4 lg:h-10";

export function DirectoryFilters({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  showActiveFilter,
}: DirectoryFiltersProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SearchInput
        value={query}
        onChange={onQueryChange}
        placeholder="Search name, email or phone"
        ariaLabel="Search members"
        className="w-full lg:max-w-sm"
      />
      <ToggleButtonGroup
        aria-label="Filter members"
        selectionMode="single"
        disallowEmptySelection
        isDetached
        selectedKeys={[filter]}
        onSelectionChange={(keys) => {
          const [next] = Array.from(keys);
          if (isDirectoryFilter(next)) onFilterChange(next);
        }}
        className="gap-2 overflow-x-auto"
      >
        <ToggleButton id={DIRECTORY_FILTER.ALL} className={chip}>
          All
        </ToggleButton>
        <ToggleButton id={DIRECTORY_FILTER.BOARD} className={chip}>
          Board
        </ToggleButton>
        {showActiveFilter && (
          <ToggleButton id={DIRECTORY_FILTER.ACTIVE} className={chip}>
            Active, last 2 years
          </ToggleButton>
        )}
      </ToggleButtonGroup>
    </div>
  );
}
