import { SearchInput } from "@/components/search-input";

interface DirectorySearchBarProps {
  filter: string;
  onFilterChange: (v: string) => void;
  // count = number of items currently shown (after filtering)
  count: number;
  // total = total available items before filtering (optional)
  total?: number;
}

export function DirectorySearchBar({
  filter,
  onFilterChange,
  count,
  // total, // if needed in future
}: DirectorySearchBarProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <SearchInput
        value={filter}
        onChange={onFilterChange}
        placeholder="Search for a user..."
        ariaLabel="Search members"
        className="sm:max-w-sm"
        onClear={() => onFilterChange("")}
      />
      <div className="text-xs text-default-400">
        Showing {count} member{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}
