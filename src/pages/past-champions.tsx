import { useState } from "react";
import { Button, Link } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChampionshipsList } from "@/components/championship-display";
import { ChampionshipsListSkeleton } from "@/components/championship-skeleton";
import { ChampionshipEditorModal } from "@/components/championship-editor-modal";
import { useAllChampionships } from "@/hooks/useChampionships";
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

  const { championships, isLoading, refetch } = useAllChampionships({
    year: showAllYears ? undefined : currentYear - 1,
  });

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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Past Champions</h1>
          <p className="text-default-600 max-w-2xl mx-auto">
            Celebrating our distinguished champions and runners-up across all
            major tournaments.
          </p>
        </div>
        <ChampionshipsListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
      <div className="text-center mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">Past Champions</h1>
            <p className="text-default-600 max-w-2xl mx-auto">
              Celebrating our distinguished champions and runners-up across all
              major tournaments.
            </p>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <Button
                color="primary"
                onPress={handleAddNew}
                startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
              >
                Add Championship
              </Button>
            </div>
          )}
        </div>

        {!showAllYears && (
          <div className="text-center">
            <Link href="/past-champions" color="success">
              View All Past Champions
            </Link>
          </div>
        )}
      </div>

      <ChampionshipsList
        championships={championships}
        showEditButtons={isAdmin}
        onEdit={handleEdit}
        emptyMessage={
          showAllYears
            ? "No championship records found"
            : `No championships found for ${currentYear - 1}`
        }
      />

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
