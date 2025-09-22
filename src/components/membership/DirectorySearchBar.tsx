import { SearchInput } from "@/components/search-input";

interface DirectorySearchBarProps {
  filter: string;
  onFilterChange: (v: string) => void;
  total: number;
  isFiltered: boolean;
}

export function DirectorySearchBar({
  filter,
  onFilterChange,
  total,
  isFiltered,
}: DirectorySearchBarProps) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
      <SearchInput
        value={filter}
        onChange={onFilterChange}
        placeholder="Search by name or email..."
        ariaLabel="Search members"
        className="sm:max-w-sm"
        onClear={() => onFilterChange("")}
      />
      <div className="text-xs text-default-400">
        Showing {isFiltered ? "filtered" : "all"} {total} member
        {total === 1 ? "" : "s"}
      </div>
    </div>
  );
}
