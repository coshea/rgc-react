import React from "react";
import {
  Card,
  CardBody,
  Input,
  Textarea,
  Button,
  DatePicker,
  Checkbox,
  NumberInput,
  Divider,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { Winner } from "@/types/winner";
import { parseDate, DateValue } from "@internationalized/date";
import { WinnerForm } from "@/components/winner-form";

interface TournamentFormProps {
  tournament?: Tournament | null;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
}

export const TournamentForm: React.FC<TournamentFormProps> = ({
  tournament,
  onSave,
  onCancel,
}) => {
  const isEditing = !!tournament;

  const [title, setTitle] = React.useState(tournament?.title || "");
  const [description, setDescription] = React.useState(
    tournament?.description || ""
  );
  const [players, setPlayers] = React.useState(tournament?.players || 1);
  const [completed, setCompleted] = React.useState(
    tournament?.completed || false
  );
  const [canceled, setCanceled] = React.useState(tournament?.canceled || false);
  const [icon] = React.useState(tournament?.icon || "/logos/default.png");
  const [prizePool, setPrizePool] = React.useState(tournament?.prizePool || 0);
  const [winners, setWinners] = React.useState<Winner[]>(
    tournament?.winners || []
  );
  const [date, setDate] = React.useState<DateValue | null>(
    tournament?.date
      ? parseDate(tournament.date.toISOString().split("T")[0])
      : null
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    if (players < 1) newErrors.players = "Must have at least 1 player";
    if (prizePool < 0) newErrors.prizePool = "Prize pool cannot be negative";

    // Validate winners if tournament is completed
    if (completed && winners.length > 0) {
      const totalPrizeAmount = winners.reduce(
        (total, winner) => total + winner.prizeAmount * winner.userIds.length,
        0
      );

      if (totalPrizeAmount > prizePool) {
        newErrors.winners = "Total prize amount exceeds prize pool";
      }

      // Check if any winner has no users selected
      const hasEmptyWinners = winners.some(
        (winner) => winner.userIds.length === 0
      );
      if (hasEmptyWinners) {
        newErrors.winners = "All winners must have users selected";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      const tournamentData: Tournament = {
        id: tournament?.id || 0,
        title,
        description,
        players,
        completed,
        canceled,
        icon,
        prizePool,
        winners,
        date: date ? new Date(date.toString()) : new Date(),
      };

      onSave(tournamentData);
    } catch (error) {
      console.error("Error saving tournament:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardBody className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">
            {isEditing ? "Edit Tournament" : "Create New Tournament"}
          </h2>
          <Button
            color="default"
            variant="light"
            isIconOnly
            onPress={onCancel}
            aria-label="Cancel"
          >
            <Icon icon="lucide:x" className="text-lg" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Input
                label="Tournament Title"
                placeholder="Enter tournament title"
                value={title}
                onValueChange={setTitle}
                isRequired
                isInvalid={!!errors.title}
                errorMessage={errors.title}
              />

              <Textarea
                label="Description"
                placeholder="Enter tournament description"
                value={description}
                onValueChange={setDescription}
                isRequired
                isInvalid={!!errors.description}
                errorMessage={errors.description}
              />

              <DatePicker
                label="Tournament Date"
                value={date}
                onChange={setDate}
                isRequired
                isInvalid={!!errors.date}
                errorMessage={errors.date}
              />

              {/* URL Path input removed */}
            </div>

            <div className="space-y-6">
              <NumberInput
                label="Number of Players"
                placeholder="Enter number of players"
                value={players}
                onValueChange={setPlayers}
                min={1}
                max={100}
                isInvalid={!!errors.players}
                errorMessage={errors.players}
              />

              <NumberInput
                label="Prize Pool ($)"
                placeholder="Enter prize amount"
                value={prizePool}
                onValueChange={setPrizePool}
                min={0}
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">$</span>
                  </div>
                }
                isInvalid={!!errors.prizePool}
                errorMessage={errors.prizePool}
              />

              <div className="flex flex-col gap-4 pt-2">
                <Checkbox isSelected={completed} onValueChange={setCompleted}>
                  Tournament Completed
                </Checkbox>

                <Checkbox
                  isSelected={canceled}
                  onValueChange={setCanceled}
                  color="danger"
                >
                  Tournament Canceled
                </Checkbox>
              </div>

              <div className="pt-4">
                <p className="text-sm text-foreground-500 mb-2">
                  Tournament Icon
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-content2 rounded-md flex items-center justify-center">
                    <Icon
                      icon="lucide:golf"
                      className="text-2xl text-primary"
                    />
                  </div>
                  <div className="text-sm text-foreground-500">
                    Default icon will be used
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Winners section */}
          {(isEditing || completed) && (
            <div className="pt-4">
              <Divider className="my-4" />
              <WinnerForm
                winners={winners}
                onWinnersChange={setWinners}
                teamSize={players}
                prizePool={prizePool}
                isCompleted={completed}
              />
              {errors.winners && (
                <p className="text-danger text-sm mt-2">{errors.winners}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button color="default" variant="flat" onPress={onCancel}>
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={isSubmitting}
              startContent={!isSubmitting && <Icon icon="lucide:save" />}
            >
              {isEditing ? "Update Tournament" : "Create Tournament"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};
