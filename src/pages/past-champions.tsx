import { useState, useEffect, useMemo } from "react";
import { Button, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChampionshipsList } from "@/components/championship-display";
import { DirectorySearchBar } from "@/components/membership/DirectorySearchBar";
import { ChampionshipsListSkeleton } from "@/components/championship-skeleton";
import { ChampionshipEditorModal } from "@/components/championship-editor-modal";
import { useInfiniteChampionships } from "@/hooks/useChampionships";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import type { UnifiedChampionship } from "@/types/championship";
import { usePageTracking } from "@/hooks/usePageTracking";

interface PastChampionsProps {
  showAllYears?: boolean;
}

export default function PastChampions({
  showAllYears = false,
}: PastChampionsProps) {
  usePageTracking("Past Champions");
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  // Start with undefined to discover all years, then narrow to latest year
  const currentYear = new Date().getFullYear();
  const [targetYear, setTargetYear] = useState<number | undefined>(undefined);

  const {
    championships,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteChampionships({
    year: targetYear,
    pageSize: 50, // Fetch ~50 championships at a time (approximately 10 years with ~5 championship types per year)
  });

  // Once we have data, calculate the actual latest year
  const latestYear = useMemo(() => {
    if (championships.length === 0) return currentYear - 1;
    return Math.max(...championships.map((c) => c.year));
  }, [championships, currentYear]);

  // Update target year once we know the actual latest year (only when not showing all years)
  useEffect(() => {
    if (
      !showAllYears &&
      championships.length > 0 &&
      targetYear !== latestYear
    ) {
      setTargetYear(latestYear);
    }
  }, [showAllYears, championships.length, targetYear, latestYear]);

  // Filter to only show complete years (exclude partial year data at the boundary)
  const { completeChampionships, completeYears, hasPartialYear } =
    useMemo(() => {
      if (!showAllYears || championships.length === 0) {
        return {
          completeChampionships: championships,
          completeYears: new Set(championships.map((c) => c.year)),
          hasPartialYear: false,
        };
      }

      // Group championships by year and count how many of each type
      const yearData = championships.reduce(
        (acc, champ) => {
          if (!acc[champ.year]) {
            acc[champ.year] = { types: new Set(), championships: [] };
          }
          acc[champ.year].types.add(champ.championshipType);
          acc[champ.year].championships.push(champ);
          return acc;
        },
        {} as Record<
          number,
          { types: Set<string>; championships: UnifiedChampionship[] }
        >,
      );

      const years = Object.keys(yearData)
        .map(Number)
        .sort((a, b) => b - a);

      // Find the most common championship type count (mode)
      const typeCounts = years.map((year) => yearData[year].types.size);
      const maxTypeCount = typeCounts.length > 0 ? Math.max(...typeCounts) : 0;

      // If the last (oldest) year has fewer championship types than the max, it's likely incomplete
      const lastYear = years[years.length - 1];
      const isLastYearPartial =
        hasNextPage && yearData[lastYear]?.types.size < maxTypeCount;

      // Filter out the partial year if detected
      const completeYearsList = isLastYearPartial ? years.slice(0, -1) : years;
      const completeYearsSet = new Set(completeYearsList);

      const filtered = championships.filter((c) =>
        completeYearsSet.has(c.year),
      );

      return {
        completeChampionships: filtered,
        completeYears: completeYearsSet,
        hasPartialYear: isLastYearPartial,
      };
    }, [championships, showAllYears, hasNextPage]);

  // Determine if we should show "Load More" button (when showing all years and more data available)
  const shouldShowLoadMore = showAllYears && (hasNextPage || hasPartialYear);

  const handleLoadMore = () => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  };

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingChampionship, setEditingChampionship] = useState<
    UnifiedChampionship | undefined
  >();

  const handleEdit = (championship: UnifiedChampionship) => {
    setEditingChampionship(championship);
    setIsEditorOpen(true);
  };

  const handleAddNew = () => {
    setEditingChampionship(undefined);
    setIsEditorOpen(true);
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setEditingChampionship(undefined);
  };

  const handleSave = () => {
    refetch();
    handleEditorClose();
  };

  // Search/filter state for past champions (matches membership directory styling)
  const [filter, setFilter] = useState("");

  // Apply simple client-side filter: match against winner or runner-up names
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredChampionships = normalizedFilter
    ? completeChampionships.filter((c: UnifiedChampionship) => {
        const haystack = [...(c.winnerNames || []), ...(c.runnerUpNames || [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedFilter);
      })
    : completeChampionships;

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 overflow-x-hidden">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold mb-2">Past Champions</h1>
          <p className="text-sm text-default-600 max-w-2xl mx-auto">
            Loading championship records...
          </p>
        </div>
        <ChampionshipsListSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 overflow-x-hidden">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold mb-2">Past Champions</h1>
          <p className="text-danger">
            Error loading championships: {error?.message || "Unknown error"}
          </p>
          <Button color="primary" onPress={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 overflow-x-hidden">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h1 className="text-2xl font-bold">Past Champions</h1>
          <div className="flex flex-wrap items-center gap-2">
            {!showAllYears && (
              <Button
                as={Link}
                href="/past-champions"
                size="sm"
                variant="flat"
                endContent={
                  <Icon icon="lucide:arrow-right" className="w-3 h-3" />
                }
                className="self-start sm:self-auto"
              >
                View All
              </Button>
            )}
            {isAdmin && showAllYears && (
              <Button
                color="primary"
                onPress={handleAddNew}
                startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
                className="self-start sm:self-auto"
              >
                Add Championship
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-default-600 mb-3">
          Celebrating our distinguished champions and runners-up across all
          major tournaments.
        </p>
      </div>

      {showAllYears && (
        <DirectorySearchBar
          filter={filter}
          onFilterChange={setFilter}
          count={filteredChampionships.length}
          total={completeChampionships.length}
        />
      )}

      <ChampionshipsList
        championships={filteredChampionships}
        showEditButtons={isAdmin}
        onEdit={handleEdit}
        emptyMessage={
          showAllYears
            ? "No championship records found"
            : `No championships found for ${latestYear}`
        }
      />

      {/* Load More button for pagination */}
      {shouldShowLoadMore && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-default-500">
            Showing {completeYears.size}{" "}
            {completeYears.size === 1 ? "year" : "years"} of championship
            history
          </p>
          <Button
            color="primary"
            variant="bordered"
            size="lg"
            onPress={handleLoadMore}
            isLoading={isFetchingNextPage}
            startContent={
              !isFetchingNextPage && (
                <Icon icon="lucide:chevron-down" className="w-5 h-5" />
              )
            }
            className="min-w-[200px]"
          >
            {isFetchingNextPage ? "Loading..." : "Load More Years"}
          </Button>
        </div>
      )}

      {isAdmin && (
        <ChampionshipEditorModal
          isOpen={isEditorOpen}
          onClose={handleEditorClose}
          championship={editingChampionship}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
