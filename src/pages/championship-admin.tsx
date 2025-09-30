import { useState } from "react";
import { Button, Tabs, Tab, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChampionshipsList } from "@/components/championship-display";
import { ChampionshipEditorModal } from "@/components/championship-editor-modal";
import {
  useAllChampionships,
  useHistoricalChampionships,
} from "@/hooks/useChampionships";
import { RequireAdmin } from "@/components/require-admin";
import type { UnifiedChampionship } from "@/types/championship";

export default function ChampionshipAdmin() {
  const { championships: allChampionships, refetch: refetchAll } =
    useAllChampionships();
  const { data: historicalOnly, refetch: refetchHistorical } =
    useHistoricalChampionships();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingChampionship, setEditingChampionship] = useState<
    UnifiedChampionship | undefined
  >();
  const [activeTab, setActiveTab] = useState("all");

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
    refetchAll();
    refetchHistorical();
    handleEditorClose();
  };

  return (
    <RequireAdmin>
      <div className="max-w-7xl mx-auto p-6 overflow-x-hidden">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Championship Administration
              </h1>
              <p className="text-default-600">
                Manage historical and modern championship records
              </p>
            </div>

            <Button
              color="primary"
              onPress={handleAddNew}
              startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
            >
              Add Championship
            </Button>
          </div>

          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            className="w-full"
          >
            <Tab key="all" title="All Championships">
              <Card>
                <CardBody>
                  <ChampionshipsList
                    championships={allChampionships}
                    showEditButtons={true}
                    onEdit={handleEdit}
                    emptyMessage="No championships found"
                  />
                </CardBody>
              </Card>
            </Tab>

            <Tab key="historical" title="Historical Only">
              <Card>
                <CardBody>
                  <ChampionshipsList
                    championships={
                      historicalOnly?.map((h) => ({
                        id: h.id,
                        year: h.year,
                        championshipType: h.championshipType,
                        winnerNames: h.winnerNames,
                        winnerIds: h.winnerIds,
                        runnerUpNames: h.runnerUpNames,
                        runnerUpIds: h.runnerUpIds,
                        isHistorical: h.isHistorical,
                      })) || []
                    }
                    showEditButtons={true}
                    onEdit={handleEdit}
                    emptyMessage="No historical championships found"
                  />
                </CardBody>
              </Card>
            </Tab>
          </Tabs>
        </div>

        <ChampionshipEditorModal
          isOpen={isEditorOpen}
          onClose={handleEditorClose}
          championship={editingChampionship}
          onSave={handleSave}
        />
      </div>
    </RequireAdmin>
  );
}
