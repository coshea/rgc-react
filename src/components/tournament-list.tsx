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
  Card,
  CardBody,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { useNavigate } from "react-router-dom";

interface TournamentListProps {
  tournaments: Tournament[];
  onEdit: (tournament: Tournament) => void;
  onDelete: (id?: string | number) => Promise<void> | void;
  isAdmin?: boolean;
}

export const TournamentList: React.FC<TournamentListProps> = ({
  tournaments,
  onEdit,
  onDelete,
  isAdmin = false,
}) => {
  const navigate = useNavigate();
  // Add state to track expanded tournament rows
  const [expandedIds, setExpandedIds] = React.useState<string[]>([]);

  const toggleExpand = (id?: string) => {
    if (!id) return;
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const formatDate = (date: Date): string => {
    // Force UTC timezone so the displayed date matches the stored date
    // (ignores local timezone offsets)
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // In-app confirmation modal state
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selectedTournament = React.useMemo(() => {
    return tournaments.find((t) => t.firestoreId === deletingId) || null;
  }, [tournaments, deletingId]);

  const openConfirm = (id?: string | number) => {
    if (!id) return;
    setDeletingId(String(id));
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    onDelete(deletingId);
    setConfirmOpen(false);
    setDeletingId(null);
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

  // New function to render mobile tournament card
  const renderStatusChips = (tournament: Tournament) =>
    // Show exactly one status with priority: Canceled > Completed > Registration Open > Scheduled
    (() => {
      if (tournament.canceled) {
        return (
          <Chip color="danger" size="sm" variant="flat">
            Canceled
          </Chip>
        );
      }

      if (tournament.completed) {
        return (
          <Chip color="success" size="sm" variant="flat">
            Completed
          </Chip>
        );
      }

      if (tournament.registrationOpen ?? false) {
        return (
          <Chip color="success" size="sm" variant="flat">
            Registration Open
          </Chip>
        );
      }

      return (
        <Chip color="primary" size="sm" variant="flat">
          Scheduled
        </Chip>
      );
    })();

  const renderMobileCard = (tournament: Tournament) => {
    const isExpanded = tournament.firestoreId
      ? expandedIds.includes(tournament.firestoreId)
      : false;

    return (
      <Card
        key={tournament.firestoreId}
        className="mb-4 border border-default-200"
      >
        <CardBody
          className="p-4"
          // make entire card body clickable to expand/collapse
          onClick={() => toggleExpand(tournament.firestoreId)}
          role="button"
          aria-pressed={isExpanded}
        >
          <div className="flex justify-between items-start cursor-pointer">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {tournament.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-foreground-500">
                  <Icon icon="lucide:calendar" className="text-xs" />
                  <span>{formatDate(tournament.date)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {renderStatusChips(tournament)}

              <div className="flex items-center gap-2">
                {/* Register button visible in mobile header when open */}
                {tournament.registrationOpen && tournament.firestoreId && (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      navigate(
                        `/tournaments/${tournament.firestoreId}/register`
                      );
                    }}
                  >
                    Register
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    toggleExpand(tournament.firestoreId);
                  }}
                  aria-label={
                    isExpanded ? "Collapse details" : "Expand details"
                  }
                >
                  <Icon
                    icon={
                      isExpanded ? "lucide:chevron-up" : "lucide:chevron-down"
                    }
                    className="text-default-500"
                  />
                </Button>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-default-100">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-foreground-500">Description</p>
                  <p className="text-sm line-clamp-2">
                    {tournament.description}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-foreground-500">Prize Pool</p>
                  <p className="text-sm font-medium">
                    {formatCurrency(tournament.prizePool)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-foreground-500">Players</p>
                  <div className="flex items-center gap-1">
                    <Icon
                      icon="lucide:users"
                      className="text-default-400 text-sm"
                    />
                    <span className="text-sm">{tournament.players}</span>
                  </div>
                </div>
              </div>

              {renderWinners(tournament)}

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onEdit(tournament);
                  }}
                  startContent={<Icon icon="lucide:edit" />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    openConfirm(tournament.firestoreId);
                  }}
                  startContent={<Icon icon="lucide:trash-2" />}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
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
    <>
      {/* Mobile view (card-based layout) */}
      <div className="md:hidden space-y-2">
        {tournaments.map((tournament) => renderMobileCard(tournament))}
      </div>

      {/* Desktop view (table layout) */}
      <div className="hidden md:block">
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
            {tournaments.map((tournament, idx) => (
              <TableRow
                key={tournament.firestoreId}
                className={
                  `group transition-colors ` +
                  `${idx % 2 === 0 ? "bg-content1/60" : "bg-content2/40"} ` +
                  `hover:bg-primary/5 ` +
                  `${tournament.canceled ? "border-l-4 border-l-danger" : tournament.completed ? "border-l-4 border-l-success" : tournament.registrationOpen ? "border-l-4 border-l-warning" : "border-l-4 border-l-default-200"}`
                }
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          tournament.firestoreId &&
                          navigate(`/tournaments/${tournament.firestoreId}`)
                        }
                        className="font-medium text-foreground hover:underline text-left"
                        aria-label={`View details for ${tournament.title}`}
                      >
                        {tournament.title}
                      </button>
                      <p className="text-xs text-foreground-500 line-clamp-2 max-w-[200px]">
                        {tournament.description}
                      </p>
                      {renderWinners(tournament)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon icon="lucide:calendar" className="text-default-400" />
                    <span>{formatDate(tournament.date)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Icon icon="lucide:users" className="text-default-400" />
                    <span>{tournament.players}</span>
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(tournament.prizePool)}</TableCell>
                <TableCell>{renderStatusChips(tournament)}</TableCell>
                <TableCell>
                  <div className="flex justify-end items-center gap-2">
                    {tournament.registrationOpen && tournament.firestoreId ? (
                      <Tooltip content="Register for the tournament">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() =>
                            navigate(
                              `/tournaments/${tournament.firestoreId}/register`
                            )
                          }
                        >
                          Register
                        </Button>
                      </Tooltip>
                    ) : null}
                    {isAdmin && (
                      <>
                        <Tooltip content="Edit tournament">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => onEdit(tournament)}
                            aria-label="Edit tournament"
                          >
                            <Icon
                              icon="lucide:edit"
                              className="text-default-600"
                            />
                          </Button>
                        </Tooltip>

                        <Tooltip content="Delete tournament" color="danger">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => openConfirm(tournament.firestoreId)}
                            aria-label="Delete tournament"
                          >
                            <Icon icon="lucide:trash-2" />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation modal (in-app) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setConfirmOpen(false);
              setDeletingId(null);
            }}
          />
          <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-md z-10">
            <h3 className="text-lg font-medium mb-2">Delete tournament</h3>
            <p className="text-sm text-foreground-500 mb-4">
              Are you sure you want to delete this tournament? This cannot be
              undone.
            </p>
            {selectedTournament && (
              <div className="text-sm text-foreground-500 mb-4">
                <p className="font-medium">Tournament:</p>
                <p>{selectedTournament.title}</p>
                <p className="font-medium mt-2">Date:</p>
                <p>{formatDate(selectedTournament.date)}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="flat"
                onPress={() => {
                  setConfirmOpen(false);
                  setDeletingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onPress={() => {
                  confirmDelete();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
