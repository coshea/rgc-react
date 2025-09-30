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
  Switch,
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

interface ChampionshipEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  championship?: UnifiedChampionship;
  onSave?: () => void;
}

interface ChampionshipFormData {
  year: number;
  championshipType: ChampionshipType;
  winnerNames: string[];
  winnerIds: string[];
  runnerUpNames: string[];
  runnerUpIds: string[];
  isHistorical: boolean;
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
    winnerNames: [""],
    winnerIds: [""],
    runnerUpNames: [],
    runnerUpIds: [],
    isHistorical: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!championship;

  useEffect(() => {
    if (championship) {
      setFormData({
        year: championship.year,
        championshipType: championship.championshipType as ChampionshipType,
        winnerNames: championship.winnerNames || [""],
        winnerIds: championship.winnerIds || [""],
        runnerUpNames: championship.runnerUpNames || [],
        runnerUpIds: championship.runnerUpIds || [],
        isHistorical: championship.isHistorical,
      });
    } else {
      // Reset form for new championship
      setFormData({
        year: new Date().getFullYear(),
        championshipType: "club-champion",
        winnerNames: [""],
        winnerIds: [""],
        runnerUpNames: [],
        runnerUpIds: [],
        isHistorical: false,
      });
    }
    setErrors({});
  }, [championship, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.isHistorical) {
      // For historical records, validate names are provided
      if (!formData.winnerNames.some((name) => name.trim())) {
        newErrors.winnerNames = "At least one winner name is required";
      }
    } else {
      // For non-historical records, validate users are selected
      if (!formData.winnerIds.some((id) => id.trim())) {
        newErrors.winnerIds = "At least one winner must be selected";
      }
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
        winnerNames: formData.winnerNames.filter((name) => name.trim()),
        winnerIds: formData.winnerIds.filter((id) => id.trim()),
        runnerUpNames: formData.runnerUpNames.filter((name) => name.trim()),
        runnerUpIds: formData.runnerUpIds.filter((id) => id.trim()),
        isHistorical: formData.isHistorical,
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
        winnerNames: [""],
        winnerIds: [""],
        runnerUpNames: [],
        runnerUpIds: [],
        isHistorical: false,
      });
      setErrors({});
      onClose();
    }
  };

  const addWinner = () => {
    setFormData((prev) => ({
      ...prev,
      winnerNames: [...prev.winnerNames, ""],
      winnerIds: [...prev.winnerIds, ""],
    }));
  };

  const removeWinner = (index: number) => {
    if (formData.winnerNames.length > 1) {
      setFormData((prev) => ({
        ...prev,
        winnerNames: prev.winnerNames.filter((_, i) => i !== index),
        winnerIds: prev.winnerIds.filter((_, i) => i !== index),
      }));
    }
  };

  const updateWinner = (index: number, field: "name" | "id", value: string) => {
    setFormData((prev) => {
      if (field === "id" && !prev.isHistorical) {
        // For non-historical records, automatically set the name from the selected user
        const selectedUser = users?.find((user) => user.id === value);
        const userName =
          selectedUser?.displayName ||
          selectedUser?.firstName ||
          selectedUser?.email ||
          "";

        return {
          ...prev,
          winnerNames: prev.winnerNames.map((name, i) =>
            i === index ? userName : name
          ),
          winnerIds: prev.winnerIds.map((id, i) => (i === index ? value : id)),
        };
      } else {
        // For historical records or name updates, update normally
        return {
          ...prev,
          winnerNames:
            field === "name"
              ? prev.winnerNames.map((name, i) => (i === index ? value : name))
              : prev.winnerNames,
          winnerIds:
            field === "id"
              ? prev.winnerIds.map((id, i) => (i === index ? value : id))
              : prev.winnerIds,
        };
      }
    });
  };

  const addRunnerUp = () => {
    setFormData((prev) => ({
      ...prev,
      runnerUpNames: [...prev.runnerUpNames, ""],
      runnerUpIds: [...prev.runnerUpIds, ""],
    }));
  };

  const removeRunnerUp = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      runnerUpNames: prev.runnerUpNames.filter((_, i) => i !== index),
      runnerUpIds: prev.runnerUpIds.filter((_, i) => i !== index),
    }));
  };

  const updateRunnerUp = (
    index: number,
    field: "name" | "id",
    value: string
  ) => {
    setFormData((prev) => {
      if (field === "id" && !prev.isHistorical) {
        // For non-historical records, automatically set the name from the selected user
        const selectedUser = users?.find((user) => user.id === value);
        const userName =
          selectedUser?.displayName ||
          selectedUser?.firstName ||
          selectedUser?.email ||
          "";

        return {
          ...prev,
          runnerUpNames: prev.runnerUpNames.map((name, i) =>
            i === index ? userName : name
          ),
          runnerUpIds: prev.runnerUpIds.map((id, i) =>
            i === index ? value : id
          ),
        };
      } else {
        // For historical records or name updates, update normally
        return {
          ...prev,
          runnerUpNames:
            field === "name"
              ? prev.runnerUpNames.map((name, i) =>
                  i === index ? value : name
                )
              : prev.runnerUpNames,
          runnerUpIds:
            field === "id"
              ? prev.runnerUpIds.map((id, i) => (i === index ? value : id))
              : prev.runnerUpIds,
        };
      }
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

          {/* Historical record toggle */}
          <div className="flex items-center justify-between p-4 bg-default-50 rounded-lg">
            <div className="flex flex-col">
              <span className="text-medium font-medium">Historical Record</span>
              <span className="text-small text-default-500">
                {formData.isHistorical
                  ? "This is a historical record (no user selection required)"
                  : "This record will link to current users"}
              </span>
            </div>
            <Switch
              isSelected={formData.isHistorical}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, isHistorical: value }))
              }
            />
          </div>

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Winners</h3>
              <Button
                size="sm"
                variant="flat"
                onPress={addWinner}
                startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
              >
                Add Winner
              </Button>
            </div>

            {formData.winnerNames.map((name, index) => (
              <div key={index} className="flex gap-2 items-start">
                {formData.isHistorical && (
                  <Input
                    label={`Winner ${index + 1} Name`}
                    value={name}
                    onValueChange={(value) =>
                      updateWinner(index, "name", value)
                    }
                    isInvalid={!!errors.winnerNames}
                    className="flex-1"
                  />
                )}

                {!formData.isHistorical && (
                  <Select
                    label={`Winner ${index + 1}`}
                    placeholder="Select a winner"
                    selectedKeys={
                      formData.winnerIds[index]
                        ? [formData.winnerIds[index]]
                        : []
                    }
                    onSelectionChange={(keys) => {
                      const userId = Array.from(keys)[0] as string;
                      updateWinner(index, "id", userId || "");
                    }}
                    isLoading={usersLoading}
                    className="flex-1"
                    aria-label={`Select winner ${index + 1}`}
                    disallowEmptySelection={false}
                  >
                    {users?.map((user) => (
                      <SelectItem key={user.id}>
                        {user.displayName || user.firstName || user.email}
                      </SelectItem>
                    )) || []}
                  </Select>
                )}

                {formData.winnerNames.length > 1 && (
                  <Button
                    isIconOnly
                    variant="flat"
                    color="danger"
                    size="lg"
                    onPress={() => removeWinner(index)}
                  >
                    <Icon icon="lucide:trash-2" className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}

            {errors.winnerNames && (
              <p className="text-danger text-sm">{errors.winnerNames}</p>
            )}
            {errors.winnerIds && (
              <p className="text-danger text-sm">{errors.winnerIds}</p>
            )}
          </div>

          {/* Runners-up Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Runners-up (Optional)</h3>
              <Button
                size="sm"
                variant="flat"
                onPress={addRunnerUp}
                startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
              >
                Add Runner-up
              </Button>
            </div>

            {formData.runnerUpNames.map((name, index) => (
              <div key={index} className="flex gap-2 items-start">
                {formData.isHistorical && (
                  <Input
                    label={`Runner-up ${index + 1} Name`}
                    value={name}
                    onValueChange={(value) =>
                      updateRunnerUp(index, "name", value)
                    }
                    className="flex-1"
                  />
                )}

                {!formData.isHistorical && (
                  <Select
                    label={`Runner-up ${index + 1}`}
                    placeholder="Select a runner-up"
                    selectedKeys={
                      formData.runnerUpIds[index]
                        ? [formData.runnerUpIds[index]]
                        : []
                    }
                    onSelectionChange={(keys) => {
                      const userId = Array.from(keys)[0] as string;
                      updateRunnerUp(index, "id", userId || "");
                    }}
                    isLoading={usersLoading}
                    className="flex-1"
                    aria-label={`Select runner-up ${index + 1}`}
                    disallowEmptySelection={false}
                  >
                    {users?.map((user) => (
                      <SelectItem key={user.id}>
                        {user.displayName || user.firstName || user.email}
                      </SelectItem>
                    )) || []}
                  </Select>
                )}

                <Button
                  isIconOnly
                  variant="flat"
                  color="danger"
                  size="lg"
                  onPress={() => removeRunnerUp(index)}
                >
                  <Icon icon="lucide:trash-2" className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Error display for runner-ups */}
          {errors.runnerUpNames && (
            <p className="text-danger text-sm">{errors.runnerUpNames}</p>
          )}
          {errors.runnerUpIds && (
            <p className="text-danger text-sm">{errors.runnerUpIds}</p>
          )}
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
