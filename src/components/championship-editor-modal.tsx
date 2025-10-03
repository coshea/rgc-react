import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
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
        })
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
      winner.name.trim()
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
    value: string
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
      onClose={handleClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: "max-h-[90vh]",
        body: "py-6",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">
            {isEditing ? "Edit Championship" : "Create Championship"}
          </h2>
          <p className="text-sm text-default-500 font-normal">
            {isEditing
              ? "Update championship details"
              : "Add a new championship record"}
          </p>
        </ModalHeader>

        <ModalBody className="gap-6">
          {/* Form errors */}
          {errors.submit && (
            <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-danger text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Year */}
            <Input
              label="Year"
              type="number"
              value={formData.year.toString()}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  year: parseInt(value) || new Date().getFullYear(),
                }))
              }
              isInvalid={!!errors.year}
              errorMessage={errors.year}
              min={1900}
              max={new Date().getFullYear() + 1}
            />

            {/* Championship Type */}
            <Select
              label="Championship Type"
              selectedKeys={[formData.championshipType]}
              onSelectionChange={(keys) => {
                const type = Array.from(keys)[0] as ChampionshipType;
                setFormData((prev) => ({ ...prev, championshipType: type }));
              }}
            >
              {Object.entries(CHAMPIONSHIP_TYPES).map(([key, label]) => (
                <SelectItem key={key}>{label}</SelectItem>
              ))}
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
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            startContent={
              !isSubmitting && <Icon icon="lucide:save" className="w-4 h-4" />
            }
          >
            {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
