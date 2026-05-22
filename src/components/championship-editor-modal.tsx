import {
  Modal,
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { addToast } from "@/providers/toast";
import type {
  UnifiedChampionship,
  ChampionshipType,
} from "@/types/championship";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";
import {
  createHistoricalChampionship,
  updateHistoricalChampionship,
} from "@/api/championships";
import { useUsers } from "@/hooks/useUsers";
import { PlayerEntrySection } from "./player-entry-section";

interface ChampionshipEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  championship?: UnifiedChampionship;
  onSave?: () => void;
}

interface ChampionshipFormData {
  year: number;
  championshipType: ChampionshipType;
  winners: Array<{
    name: string;
    id: string;
    isHistorical: boolean;
  }>;
  runnersUp: Array<{
    name: string;
    id: string;
    isHistorical: boolean;
  }>;
}

export function ChampionshipEditorModal({
  isOpen,
  onClose,
  championship,
  onSave,
}: ChampionshipEditorModalProps) {
  const { users, isLoading: usersLoading } = useUsers();

  const [formData, setFormData] = useState<ChampionshipFormData>({
    year: new Date().getFullYear(),
    championshipType: "club-champion",
    winners: [{ name: "", id: "", isHistorical: false }],
    runnersUp: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!championship;

  useEffect(() => {
    if (championship) {
      const winners = (championship.winnerNames || [""]).map((name, index) => ({
        name,
        id: championship.winnerIds?.[index] || "",
        isHistorical: championship.isHistorical,
      }));

      const runnersUp = (championship.runnerUpNames || []).map(
        (name, index) => ({
          name,
          id: championship.runnerUpIds?.[index] || "",
          isHistorical: championship.isHistorical,
        }),
      );

      setFormData({
        year: championship.year,
        championshipType: championship.championshipType as ChampionshipType,
        winners:
          winners.length > 0
            ? winners
            : [{ name: "", id: "", isHistorical: false }],
        runnersUp,
      });
    } else {
      // Reset form for new championship
      setFormData({
        year: new Date().getFullYear(),
        championshipType: "club-champion",
        winners: [{ name: "", id: "", isHistorical: false }],
        runnersUp: [],
      });
    }
    setErrors({});
  }, [championship, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate winners
    const hasWinnerNames = formData.winners.some((winner) =>
      winner.name.trim(),
    );
    const hasWinnerIds = formData.winners.some((winner) => winner.id.trim());

    if (!hasWinnerNames && !hasWinnerIds) {
      newErrors.winnerNames =
        "At least one winner name or selection is required";
    }

    if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
      newErrors.year = "Please enter a valid year";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const championshipData = {
        year: formData.year,
        championshipType: formData.championshipType,
        winnerNames: formData.winners
          .filter((w) => w.name.trim())
          .map((w) => w.name),
        winnerIds: formData.winners.filter((w) => w.id.trim()).map((w) => w.id),
        runnerUpNames: formData.runnersUp
          .filter((r) => r.name.trim())
          .map((r) => r.name),
        runnerUpIds: formData.runnersUp
          .filter((r) => r.id.trim())
          .map((r) => r.id),
        isHistorical:
          formData.winners.some((w) => w.isHistorical) ||
          formData.runnersUp.some((r) => r.isHistorical),
      };

      if (isEditing && championship) {
        await updateHistoricalChampionship(championship.id, championshipData);
      } else {
        await createHistoricalChampionship(championshipData);
      }

      onSave?.();
      onClose();

      // Show success toast
      addToast({
        title: "Success",
        description: `Championship ${isEditing ? "updated" : "created"} successfully`,
        color: "success",
      });
    } catch (error) {
      console.error("Failed to save championship:", error);

      // Show error toast
      addToast({
        title: "Error",
        description: "Failed to save championship. Please try again.",
        color: "danger",
      });

      setErrors({ submit: "Failed to save championship. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        year: new Date().getFullYear(),
        championshipType: "club-champion",
        winners: [{ name: "", id: "", isHistorical: false }],
        runnersUp: [],
      });
      setErrors({});
      onClose();
    }
  };

  // Winner handlers
  const addWinner = () => {
    setFormData((prev) => ({
      ...prev,
      winners: [...prev.winners, { name: "", id: "", isHistorical: false }],
    }));
  };

  const removeWinner = (index: number) => {
    if (formData.winners.length > 1) {
      setFormData((prev) => ({
        ...prev,
        winners: prev.winners.filter((_, i) => i !== index),
      }));
    }
  };

  const updateWinner = (index: number, field: "name" | "id", value: string) => {
    setFormData((prev) => {
      const newWinners = [...prev.winners];
      const winner = newWinners[index];

      if (field === "id" && !winner.isHistorical) {
        // For non-historical records, automatically set the name from the selected user
        const selectedUser = users?.find((user) => user.id === value);
        const userName =
          selectedUser?.displayName ||
          selectedUser?.firstName ||
          selectedUser?.email ||
          "";

        newWinners[index] = {
          ...winner,
          name: userName,
          id: value,
        };
      } else {
        // For historical records or name updates, update the specific field
        newWinners[index] = {
          ...winner,
          [field]: value,
        };
      }

      return {
        ...prev,
        winners: newWinners,
      };
    });
  };

  const updateWinnerHistorical = (index: number, isHistorical: boolean) => {
    setFormData((prev) => {
      const newWinners = [...prev.winners];
      newWinners[index] = {
        ...newWinners[index],
        isHistorical,
        // Clear the unused field when switching modes
        name: isHistorical ? newWinners[index].name : "",
        id: isHistorical ? "" : newWinners[index].id,
      };

      return {
        ...prev,
        winners: newWinners,
      };
    });
  };

  // Runner-up handlers
  const addRunnerUp = () => {
    setFormData((prev) => ({
      ...prev,
      runnersUp: [...prev.runnersUp, { name: "", id: "", isHistorical: false }],
    }));
  };

  const removeRunnerUp = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      runnersUp: prev.runnersUp.filter((_, i) => i !== index),
    }));
  };

  const updateRunnerUp = (
    index: number,
    field: "name" | "id",
    value: string,
  ) => {
    setFormData((prev) => {
      const newRunnersUp = [...prev.runnersUp];
      const runnerUp = newRunnersUp[index];

      if (field === "id" && !runnerUp.isHistorical) {
        // For non-historical records, automatically set the name from the selected user
        const selectedUser = users?.find((user) => user.id === value);
        const userName =
          selectedUser?.displayName ||
          selectedUser?.firstName ||
          selectedUser?.email ||
          "";

        newRunnersUp[index] = {
          ...runnerUp,
          name: userName,
          id: value,
        };
      } else {
        // For historical records or name updates, update the specific field
        newRunnersUp[index] = {
          ...runnerUp,
          [field]: value,
        };
      }

      return {
        ...prev,
        runnersUp: newRunnersUp,
      };
    });
  };

  const updateRunnerUpHistorical = (index: number, isHistorical: boolean) => {
    setFormData((prev) => {
      const newRunnersUp = [...prev.runnersUp];
      newRunnersUp[index] = {
        ...newRunnersUp[index],
        isHistorical,
        // Clear the unused field when switching modes
        name: isHistorical ? newRunnersUp[index].name : "",
        id: isHistorical ? "" : newRunnersUp[index].id,
      };

      return {
        ...prev,
        runnersUp: newRunnersUp,
      };
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">
                {isEditing ? "Edit Championship" : "Create Championship"}
              </h2>
              <p className="text-sm text-muted font-normal">
                {isEditing
                  ? "Update championship details"
                  : "Add a new championship record"}
              </p>
            </Modal.Header>

            <Modal.Body className="gap-6">
              {/* Form errors */}
              {errors.submit && (
                <div className="p-3 bg-danger border border-danger-200 rounded-lg">
                  <p className="text-danger text-sm">{errors.submit}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Year */}
                <TextField
                  value={formData.year.toString()}
                  onChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      year: parseInt(v) || new Date().getFullYear(),
                    }))
                  }
                  isInvalid={!!errors.year}
                >
                  <Label>Year</Label>
                  <Input
                    type="number"
                    min={1900}
                    max={new Date().getFullYear() + 1}
                  />
                  <FieldError>{errors.year}</FieldError>
                </TextField>

                {/* Championship Type */}
                <Select
                  value={formData.championshipType}
                  onChange={(key) => {
                    if (key) {
                      const type = key as ChampionshipType;
                      setFormData((prev) => ({
                        ...prev,
                        championshipType: type,
                      }));
                    }
                  }}
                >
                  <Label>Championship Type</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {Object.entries(CHAMPIONSHIP_TYPES).map(
                        ([key, label]) => (
                          <ListBox.Item key={key} id={key} textValue={label}>
                            {label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ),
                      )}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              {/* Winners Section */}
              <PlayerEntrySection
                title="Winners"
                buttonText="Add Winner"
                entries={formData.winners}
                users={users}
                usersLoading={usersLoading}
                errors={{
                  names: errors.winnerNames,
                  ids: errors.winnerIds,
                }}
                required={true}
                onAdd={addWinner}
                onRemove={removeWinner}
                onUpdate={updateWinner}
                onUpdateHistorical={updateWinnerHistorical}
              />

              {/* Runners-up Section */}
              <PlayerEntrySection
                title="Runners-up"
                buttonText="Add Runner-up"
                entries={formData.runnersUp}
                users={users}
                usersLoading={usersLoading}
                errors={{
                  names: errors.runnerUpNames,
                  ids: errors.runnerUpIds,
                }}
                required={false}
                onAdd={addRunnerUp}
                onRemove={removeRunnerUp}
                onUpdate={updateRunnerUp}
                onUpdateHistorical={updateRunnerUpHistorical}
              />
            </Modal.Body>

            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onPress={handleSubmit}>
                {!isSubmitting && (
                  <Icon icon="lucide:save" className="w-4 h-4" />
                )}
                {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
