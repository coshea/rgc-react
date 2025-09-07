import React from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Tooltip,
  Button,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "../types/tournament";

interface TournamentListProps {
  tournaments: Tournament[];
  onEdit: (tournament: Tournament) => void;
  onDelete: (id: number) => void;
}

export const TournamentList: React.FC<TournamentListProps> = ({
  tournaments,
  onEdit,
  onDelete,
}) => {
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this tournament?")) {
      onDelete(id);
    }
  };

  // New function to render winners
  const renderWinners = (tournament: Tournament) => {
    if (!tournament.completed || (tournament.winners || []).length === 0) {
      return null;
    }

    // Sort winners by place
    const sortedWinners = [...(tournament.winners || [])].sort(
      (a, b) => a.place - b.place
    );

    return (
      <div className="mt-2">
        <p className="text-xs text-foreground-500 mb-1">Winners:</p>
        <div className="flex flex-wrap gap-1">
          {sortedWinners.map((winner) => {
            const place =
              winner.place === 1
                ? "1st"
                : winner.place === 2
                  ? "2nd"
                  : winner.place === 3
                    ? "3rd"
                    : `${winner.place}th`;

            return (
              <Tooltip
                key={winner.place}
                content={
                  <div className="px-1 py-2">
                    <p className="font-medium">{place} Place</p>
                    <p>{winner.displayNames.join(", ")}</p>
                    <p className="text-xs mt-1">
                      ${winner.prizeAmount} per person
                    </p>
                  </div>
                }
              >
                <Chip
                  size="sm"
                  variant="flat"
                  color={winner.place === 1 ? "warning" : "primary"}
                  className="cursor-help"
                >
                  {place}: {winner.displayNames.join(", ")}
                </Chip>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12 bg-content1 rounded-lg border border-default-200">
        <Icon
          icon="lucide:calendar-off"
          className="mx-auto text-4xl text-default-400 mb-3"
        />
        <h3 className="text-lg font-medium text-foreground mb-1">
          No tournaments found
        </h3>
        <p className="text-foreground-500">
          Create your first tournament to get started
        </p>
      </div>
    );
  }

  return (
    <Table
      aria-label="Tournaments list"
      removeWrapper
      className="bg-content1 rounded-lg border border-default-200"
    >
      <TableHeader>
        <TableColumn>TOURNAMENT</TableColumn>
        <TableColumn>DATE</TableColumn>
        <TableColumn>PLAYERS</TableColumn>
        <TableColumn>PRIZE POOL</TableColumn>
        <TableColumn>STATUS</TableColumn>
        <TableColumn className="text-right">ACTIONS</TableColumn>
      </TableHeader>
      <TableBody>
        {tournaments.map((tournament) => (
          <TableRow key={tournament.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-content2 rounded-md flex items-center justify-center">
                  <Icon icon="lucide:golf" className="text-xl text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {tournament.title}
                  </p>
                  <p className="text-xs text-foreground-500 truncate max-w-[200px]">
                    {tournament.description}
                  </p>
                  {renderWinners(tournament)}
                </div>
              </div>
            </TableCell>
            <TableCell>{formatDate(tournament.date)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Icon icon="lucide:users" className="text-default-400" />
                <span>{tournament.players}</span>
              </div>
            </TableCell>
            <TableCell>{formatCurrency(tournament.prizePool)}</TableCell>
            <TableCell>
              {tournament.canceled ? (
                <Chip color="danger" size="sm" variant="flat">
                  Canceled
                </Chip>
              ) : tournament.completed ? (
                <Chip color="success" size="sm" variant="flat">
                  Completed
                </Chip>
              ) : (
                <Chip color="primary" size="sm" variant="flat">
                  Scheduled
                </Chip>
              )}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Tooltip content="Edit tournament">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => onEdit(tournament)}
                    aria-label="Edit tournament"
                  >
                    <Icon icon="lucide:edit" className="text-default-600" />
                  </Button>
                </Tooltip>
                <Tooltip content="Delete tournament" color="danger">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => handleDelete(tournament.id)}
                    aria-label="Delete tournament"
                  >
                    <Icon icon="lucide:trash-2" />
                  </Button>
                </Tooltip>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
