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
import { TeeBadge } from "@/components/tee-badge";

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

    // Filter only first-place winner entries (there should typically be one)
    const firstPlace = (tournament.winners || []).filter((w) => w.place === 1);
    if (!firstPlace.length) return null;

    const champion = firstPlace[0];
    const placeLabel = "1st"; // always 1st here
    const names = champion.displayNames.join(", ");

    return (
      <div className="mt-2">
        <p className="text-xs text-foreground-500 mb-1">Winner:</p>
        <div className="flex flex-wrap gap-1">
          <Tooltip
            content={
              <div className="px-1 py-2">
                <p className="font-medium">{placeLabel} Place</p>
                <p>{names}</p>
                {typeof champion.prizeAmount === "number" && (
                  <p className="text-xs mt-1">
                    ${champion.prizeAmount} per person
                  </p>
                )}
              </div>
            }
          >
            <Chip
              size="sm"
              variant="flat"
              color="warning"
              className="cursor-help"
              startContent={<Icon icon="lucide:trophy" className="w-3 h-3" />}
            >
              {names}
            </Chip>
          </Tooltip>
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
          <Chip color="warning" size="sm" variant="flat">
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
    const goToDetails = () => {
      if (tournament.firestoreId) {
        navigate(`/tournaments/${tournament.firestoreId}`);
      }
    };
    return (
      <Card
        key={tournament.firestoreId}
        className="mb-4 border border-default-200 cursor-pointer hover:bg-content2 transition-colors"
        onPress={goToDetails as any}
        role="link"
        aria-label={`View details for ${tournament.title}`}
      >
        <CardBody className="p-4" onClick={goToDetails}>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-foreground mb-1 flex items-center gap-2">
                {tournament.title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-500">
                <span className="inline-flex items-center gap-1">
                  <Icon icon="lucide:calendar" className="w-3.5 h-3.5" />
                  {formatDate(tournament.date)}
                </span>
                <TeeBadge
                  tee={tournament.tee}
                  size="xs"
                  ariaLabel={`${tournament.tee || "Mixed"} tee designation`}
                />
              </div>
              <p className="text-xs text-foreground-500 mt-2 line-clamp-2">
                {tournament.description}
              </p>
              {renderWinners(tournament)}
            </div>
            <div className="flex flex-col items-end gap-2">
              {renderStatusChips(tournament)}
              <div className="text-right">
                <p className="text-[11px] text-foreground-500">Prize:</p>
                <p className="text-sm font-medium">
                  {formatCurrency(tournament.prizePool)}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs text-foreground-500">
                  <Icon icon="lucide:users" className="w-3.5 h-3.5" />
                  {tournament.players}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1 mt-1">
                  <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      onEdit(tournament);
                    }}
                    aria-label="Edit tournament"
                  >
                    <Icon icon="lucide:edit" />
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    isIconOnly
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      openConfirm(tournament.firestoreId);
                    }}
                    aria-label="Delete tournament"
                  >
                    <Icon icon="lucide:trash-2" />
                  </Button>
                </div>
              )}
            </div>
          </div>
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
            <TableColumn>TEE</TableColumn>
            <TableColumn>PRIZE POOL</TableColumn>
            <TableColumn>STATUS</TableColumn>
          </TableHeader>
          <TableBody>
            {tournaments.map((tournament, idx) => (
              <TableRow
                key={tournament.firestoreId}
                className={
                  `group transition-colors cursor-pointer ` +
                  `${idx % 2 === 0 ? "bg-content1/60" : "bg-content2/40"} ` +
                  `hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ` +
                  `${tournament.canceled ? "border-l-4 border-l-danger" : tournament.completed ? "border-l-4 border-l-success" : tournament.registrationOpen ? "border-l-4 border-l-warning" : "border-l-4 border-l-default-200"}`
                }
                role="link"
                tabIndex={0}
                onClick={() =>
                  tournament.firestoreId &&
                  navigate(`/tournaments/${tournament.firestoreId}`)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tournament.firestoreId &&
                      navigate(`/tournaments/${tournament.firestoreId}`);
                  }
                }}
                aria-label={`View details for ${tournament.title}`}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-foreground text-left flex items-center gap-2">
                        {tournament.title}
                      </p>
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
                <TableCell>
                  <div className="flex items-center">
                    <TeeBadge
                      tee={tournament.tee as any}
                      size="sm"
                      ariaLabel={`${tournament.tee || "Mixed"} tee designation`}
                    />
                  </div>
                </TableCell>
                <TableCell>{formatCurrency(tournament.prizePool)}</TableCell>
                <TableCell>{renderStatusChips(tournament)}</TableCell>
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
