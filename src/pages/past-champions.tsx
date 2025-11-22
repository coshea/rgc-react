import { useState, useEffect, useMemo } from "react";
import { Button, Link, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChampionshipsList } from "@/components/championship-display";
import { DirectorySearchBar } from "@/components/membership/DirectorySearchBar";
import { ChampionshipsListSkeleton } from "@/components/championship-skeleton";
import { ChampionshipEditorModal } from "@/components/championship-editor-modal";
import { useInfiniteChampionships } from "@/hooks/useChampionships";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import type { UnifiedChampionship } from "@/types/championship";

interface PastChampionsProps {
  showAllYears?: boolean;
}

export default function PastChampions({
  showAllYears = false,
}: PastChampionsProps) {
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
    pageSize: 20,
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

  const { targetRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "100px",
  });

  // Trigger fetch when intersection observer detects end of list
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
    ? championships.filter((c: UnifiedChampionship) => {
        const haystack = [...(c.winnerNames || []), ...(c.runnerUpNames || [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedFilter);
      })
    : championships;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
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
      <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 overflow-x-hidden">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <h1 className="text-2xl font-bold">Past Champions</h1>
          {isAdmin && (
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
        <p className="text-sm text-default-600 mb-3">
          Celebrating our distinguished champions and runners-up across all
          major tournaments.
        </p>

        {!showAllYears && (
          <div className="text-center">
            <Link href="/past-champions" color="success">
              View All Past Champions
            </Link>
          </div>
        )}
      </div>

      {showAllYears && (
        <DirectorySearchBar
          filter={filter}
          onFilterChange={setFilter}
          count={filteredChampionships.length}
          total={championships.length}
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

      {/* Infinite scroll trigger and loading indicator */}
      {championships.length > 0 && (
        <div ref={targetRef} className="flex justify-center py-4">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-default-500">
                Loading more championships...
              </span>
            </div>
          )}
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
