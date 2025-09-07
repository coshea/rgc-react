import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  NumberInput,
  Select,
  SelectItem,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Winner } from "@/types/winner";
import { getUsers, User } from "@/api/users";

interface WinnerFormProps {
  winners: Winner[];
  onWinnersChange: (winners: Winner[]) => void;
  teamSize: number;
  prizePool: number;
  isCompleted: boolean;
}

export const WinnerForm: React.FC<WinnerFormProps> = ({
  winners,
  onWinnersChange,
  teamSize,
  prizePool,
  isCompleted,
}) => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        // Optionally, show a toast or error message to the user
      }
    };

    fetchUsers();
  }, []);

  const addWinner = () => {
    const nextPlace =
      winners.length > 0 ? Math.max(...winners.map((w) => w.place)) + 1 : 1;

    const newWinner: Winner = {
      place: nextPlace,
      userIds: [],
      displayNames: [],
      prizeAmount: 0,
    };

    onWinnersChange([...winners, newWinner]);
  };

  const removeWinner = (place: number) => {
    const updatedWinners = winners
      .filter((w) => w.place !== place)
      .map((w, i) => ({
        ...w,
        place: i + 1, // Reorder places after removal
      }));

    onWinnersChange(updatedWinners);
  };

  const updateWinner = (place: number, updates: Partial<Winner>) => {
    const updatedWinners = winners.map((w) =>
      w.place === place ? { ...w, ...updates } : w
    );

    onWinnersChange(updatedWinners);
  };

  const handleUserSelection = (place: number, userIds: string[]) => {
    const selectedUsers = users.filter((user) => userIds.includes(user.id));
    const displayNames = selectedUsers.map((user) => user.displayName);

    updateWinner(place, {
      userIds,
      displayNames,
    });
  };

  const getPlaceLabel = (place: number): string => {
    if (place === 1) return "1st Place";
    if (place === 2) return "2nd Place";
    if (place === 3) return "3rd Place";
    return `${place}th Place`;
  };

  const calculateTotalPrize = (winner: Winner): number => {
    return winner.userIds.length * winner.prizeAmount;
  };

  const calculateTotalPrizePool = (): number => {
    return winners.reduce(
      (total, winner) => total + calculateTotalPrize(winner),
      0
    );
  };

  const remainingPrizePool = prizePool - calculateTotalPrizePool();

  // Sort winners by place
  const sortedWinners = [...winners].sort((a, b) => a.place - b.place);

  if (!isCompleted) {
    return (
      <div className="bg-content2 p-4 rounded-md text-center text-foreground-500">
        <Icon
          icon="lucide:trophy"
          className="mx-auto text-2xl mb-2 text-default-400"
        />
        <p>Winners can be added once the tournament is marked as completed</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Tournament Winners</h3>
        <div className="flex items-center gap-2">
          <Tooltip content="Remaining prize pool">
            <Chip
              color={remainingPrizePool < 0 ? "danger" : "success"}
              variant="flat"
              className="min-w-[100px] justify-center"
            >
              ${remainingPrizePool.toLocaleString()}
            </Chip>
          </Tooltip>
          <Button
            size="sm"
            color="primary"
            variant="flat"
            startContent={<Icon icon="lucide:plus" />}
            onPress={addWinner}
            isDisabled={remainingPrizePool <= 0}
          >
            Add Winner
          </Button>
        </div>
      </div>

      {sortedWinners.length === 0 ? (
        <div className="bg-content2 p-4 rounded-md text-center text-foreground-500">
          <p>No winners added yet. Click "Add Winner" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedWinners.map((winner) => (
            <Card key={winner.place} className="w-full">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon
                      icon={
                        winner.place === 1 ? "lucide:trophy" : "lucide:medal"
                      }
                      className={`text-xl ${winner.place === 1 ? "text-warning" : "text-default-400"}`}
                    />
                    <h4 className="font-medium">
                      {getPlaceLabel(winner.place)}
                    </h4>
                  </div>
                  <Button
                    size="sm"
                    isIconOnly
                    color="danger"
                    variant="light"
                    onPress={() => removeWinner(winner.place)}
                    aria-label={`Remove ${getPlaceLabel(winner.place)}`}
                  >
                    <Icon icon="lucide:trash-2" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Select
                      label="Select Winner(s)"
                      placeholder={
                        teamSize > 1 ? "Select team members" : "Select winner"
                      }
                      selectionMode={teamSize > 1 ? "multiple" : "single"}
                      selectedKeys={new Set(winner.userIds)}
                      onSelectionChange={(keys) => {
                        const selectedKeys = Array.from(keys);
                        handleUserSelection(
                          winner.place,
                          selectedKeys as string[]
                        );
                      }}
                      isRequired
                      className="w-full"
                      isInvalid={winner.userIds.length === 0}
                      errorMessage={
                        winner.userIds.length === 0 ? "Winner is required" : ""
                      }
                    >
                      {users.map((user) => (
                        <SelectItem key={user.id}>
                          {user.displayName}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <NumberInput
                    label="Prize Amount (per person)"
                    placeholder="Enter prize amount"
                    value={winner.prizeAmount}
                    onValueChange={(value) =>
                      updateWinner(winner.place, { prizeAmount: value })
                    }
                    min={0}
                    startContent={
                      <div className="pointer-events-none flex items-center">
                        <span className="text-default-400 text-small">$</span>
                      </div>
                    }
                  />
                </div>

                {winner.displayNames.length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {winner.displayNames.map((name, index) => (
                        <Chip
                          key={index}
                          color="primary"
                          variant="flat"
                          size="sm"
                        >
                          {name}
                        </Chip>
                      ))}
                    </div>

                    <div className="mt-2 text-sm text-foreground-500">
                      Total prize: $
                      {calculateTotalPrize(winner).toLocaleString()}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {winners.length > 0 && (
        <div className="flex justify-between items-center pt-2 text-sm">
          <div>
            Total allocated: ${calculateTotalPrizePool().toLocaleString()}
          </div>
          <div
            className={remainingPrizePool < 0 ? "text-danger" : "text-success"}
          >
            Remaining: ${remainingPrizePool.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
