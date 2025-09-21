import { Input } from "@heroui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

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
      <Input
        isClearable
        size="sm"
        radius="full"
        placeholder="Search by name or email..."
        startContent={
          <MagnifyingGlassIcon className="w-4 h-4 text-default-400" />
        }
        value={filter}
        onClear={() => onFilterChange("")}
        onValueChange={(v: string) => onFilterChange(v)}
        className="sm:max-w-sm"
      />
      <div className="text-xs text-default-400">
        Showing {isFiltered ? "filtered" : "all"} {total} member
        {total === 1 ? "" : "s"}
      </div>
    </div>
  );
}
