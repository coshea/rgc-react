import { useState, useEffect } from "react";
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
  const currentYear = new Date().getFullYear();

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
    year: showAllYears ? undefined : currentYear - 1,
    pageSize: 20,
  });

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
    ? championships.filter((c) => {
        const haystack = [...(c.winnerNames || []), ...(c.runnerUpNames || [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedFilter);
      })
    : championships;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Past Champions</h1>
          <p className="text-default-600 max-w-2xl mx-auto">
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
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Past Champions</h1>
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
    <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Past Champions</h1>
        <p className="text-default-600 max-w-2xl mx-auto mb-4">
          Celebrating our distinguished champions and runners-up across all
          major tournaments.
        </p>

        {isAdmin && (
          <div className="mb-4">
            <Button
              color="primary"
              onPress={handleAddNew}
              startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
            >
              Add Championship
            </Button>
          </div>
        )}

        {!showAllYears && (
          <div className="text-center">
            <Link href="/past-champions" color="success">
              View All Past Champions
            </Link>
          </div>
        )}
      </div>

      <DirectorySearchBar
        filter={filter}
        onFilterChange={setFilter}
        count={filteredChampionships.length}
        total={championships.length}
      />

      <ChampionshipsList
        championships={filteredChampionships}
        showEditButtons={isAdmin}
        onEdit={handleEdit}
        emptyMessage={
          showAllYears
            ? "No championship records found"
            : `No championships found for ${currentYear - 1}`
        }
      />

      {/* Infinite scroll trigger and loading indicator */}
      {championships.length > 0 && (
        <div ref={targetRef} className="flex justify-center py-8">
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
