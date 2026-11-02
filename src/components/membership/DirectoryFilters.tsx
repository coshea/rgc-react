import { Segment } from "@heroui-pro/react/segment";

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

const item = "h-11 lg:h-10";

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
      <Segment
        aria-label="Filter members"
        size="lg"
        selectedKey={filter}
        onSelectionChange={(key) => {
          if (isDirectoryFilter(key)) onFilterChange(key);
        }}
        className="w-full lg:w-auto"
      >
        <Segment.Item id={DIRECTORY_FILTER.ALL} className={item}>
          All
        </Segment.Item>
        <Segment.Item id={DIRECTORY_FILTER.BOARD} className={item}>
          Board
        </Segment.Item>
        {showActiveFilter && (
          <Segment.Item id={DIRECTORY_FILTER.ACTIVE} className={item}>
            Active, last 2 years
          </Segment.Item>
        )}
      </Segment>
    </div>
  );
}
