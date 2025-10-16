import React from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Card,
  CardBody,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus, statusText } from "@/utils/tournamentStatus";
import { useNavigate } from "react-router-dom";
import { TeeBadge } from "@/components/tee-badge";
import type { WinnerGroup } from "@/types/winner";

interface TournamentListProps {
  tournaments: Tournament[];
  onEdit: (tournament: Tournament) => void;
  onDelete: (id?: string | number) => Promise<void> | void;
  isAdmin?: boolean;
}

type FilterStatus =
  | "all"
  | "completed"
  | "registration"
  | "scheduled"
  | "canceled";

export const TournamentList: React.FC<TournamentListProps> = ({
  tournaments,
  onEdit,
  onDelete,
  isAdmin = false,
}) => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");

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

  // Filter tournaments based on selected status
  const filteredTournaments = React.useMemo(() => {
    if (filterStatus === "all") return tournaments;

    return tournaments.filter((tournament) => {
      const status = getStatus(tournament);
      switch (filterStatus) {
        case "completed":
          return status === TournamentStatus.Completed;
        case "registration":
          return status === TournamentStatus.Open;
        case "scheduled":
          return status === TournamentStatus.Upcoming;
        case "canceled":
          return status === TournamentStatus.Canceled;
        default:
          return true;
      }
    });
  }, [tournaments, filterStatus]);

  // Count tournaments for each filter
  const filterCounts = React.useMemo(() => {
    const counts = {
      all: tournaments.length,
      completed: 0,
      registration: 0,
      scheduled: 0,
      canceled: 0,
    };

    tournaments.forEach((tournament) => {
      const status = getStatus(tournament);
      if (status === TournamentStatus.Canceled) counts.canceled++;
      else if (status === TournamentStatus.Completed) counts.completed++;
      else if (status === TournamentStatus.Open) counts.registration++;
      else counts.scheduled++;
    });

    return counts;
  }, [tournaments]);

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

  // Card winners summary: simple first-place line from the lowest-order winner group
  const renderWinners = (tournament: Tournament) => {
    // Only show a summary when there are grouped winners and the event has results
    const status = getStatus(tournament);
    if (status !== TournamentStatus.Completed) return null;

    const groups = (tournament as any).winnerGroups as
      | WinnerGroup[]
      | undefined;

    if (!groups || groups.length === 0) return null; // skip legacy in summary

    // Pick the winner group with the lowest order that has at least one place
    const targetGroup = [...groups]
      .filter((g) => (g.winners || []).length > 0)
      .sort((a, b) => a.order - b.order)[0];
    if (!targetGroup) return null;

    const entries = targetGroup.winners || [];
    if (entries.length === 0) return null;

    // Find the lowest place number present (usually 1)
    const places = entries
      .map((e) => (typeof e.place === "number" ? e.place : Infinity))
      .filter((p) => Number.isFinite(p)) as number[];
    if (places.length === 0) return null;
    const topPlace = Math.min(...places);
    const firstPlaceEntry = entries.find((e) => e.place === topPlace);
    if (!firstPlaceEntry) return null;

    const names = (firstPlaceEntry.competitors || [])
      .map((c) => c?.displayName || "")
      .filter(Boolean);
    if (names.length === 0) return null;

    const metaBits: string[] = [];
    if (firstPlaceEntry.score) metaBits.push("Score: " + firstPlaceEntry.score);
    if (typeof firstPlaceEntry.prizeAmount === "number")
      metaBits.push(`$${firstPlaceEntry.prizeAmount}`);
    const meta = metaBits.join(" • ");

    return (
      <div className="mt-2 text-xs text-foreground-500">
        <span className="font-medium text-foreground">Winners:</span>{" "}
        {names.join(" • ")}
        {meta ? ` • ${meta}` : ""}
      </div>
    );
  };

  // New function to render status chips
  const renderStatusChips = (tournament: Tournament) => {
    // Show exactly one status with priority: Canceled > Completed > In Progress > Registration Open > Scheduled
    const status = getStatus(tournament);
    if (status === TournamentStatus.Canceled) {
      return (
        <Chip color="danger" size="sm" variant="flat">
          {statusText(status)}
        </Chip>
      );
    }

    if (status === TournamentStatus.Completed) {
      return (
        <Chip color="success" size="sm" variant="flat">
          {statusText(status)}
        </Chip>
      );
    }

    if (status === TournamentStatus.InProgress) {
      return (
        <Chip color="primary" size="sm" variant="flat">
          {statusText(status)}
        </Chip>
      );
    }

    if (status === TournamentStatus.Open) {
      return (
        <Chip color="warning" size="sm" variant="flat">
          {statusText(status)}
        </Chip>
      );
    }

    return (
      <Chip color="primary" size="sm" variant="flat">
        {statusText(status)}
      </Chip>
    );
  };

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
      {/* Filter buttons */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterStatus === "all" ? "solid" : "flat"}
            color={filterStatus === "all" ? "primary" : "default"}
            size="sm"
            onPress={() => setFilterStatus("all")}
          >
            All ({filterCounts.all})
          </Button>
          <Button
            variant={filterStatus === "registration" ? "solid" : "flat"}
            color={filterStatus === "registration" ? "warning" : "default"}
            size="sm"
            onPress={() => setFilterStatus("registration")}
            startContent={<Icon icon="lucide:user-plus" className="w-4 h-4" />}
          >
            Registration Open ({filterCounts.registration})
          </Button>
          <Button
            variant={filterStatus === "scheduled" ? "solid" : "flat"}
            color={filterStatus === "scheduled" ? "primary" : "default"}
            size="sm"
            onPress={() => setFilterStatus("scheduled")}
            startContent={<Icon icon="lucide:calendar" className="w-4 h-4" />}
          >
            Scheduled ({filterCounts.scheduled})
          </Button>
          <Button
            variant={filterStatus === "completed" ? "solid" : "flat"}
            color={filterStatus === "completed" ? "success" : "default"}
            size="sm"
            onPress={() => setFilterStatus("completed")}
            startContent={
              <Icon icon="lucide:check-circle" className="w-4 h-4" />
            }
          >
            Completed ({filterCounts.completed})
          </Button>
          {filterCounts.canceled > 0 && (
            <Button
              variant={filterStatus === "canceled" ? "solid" : "flat"}
              color={filterStatus === "canceled" ? "danger" : "default"}
              size="sm"
              onPress={() => setFilterStatus("canceled")}
              startContent={<Icon icon="lucide:x-circle" className="w-4 h-4" />}
            >
              Canceled ({filterCounts.canceled})
            </Button>
          )}
        </div>
      </div>
      {/* Mobile view (card-based layout) */}
      <div className="md:hidden space-y-2">
        {filteredTournaments.map((tournament) => renderMobileCard(tournament))}
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
            {filteredTournaments.map((tournament, idx) => (
              <TableRow
                key={tournament.firestoreId}
                className={
                  `group transition-colors cursor-pointer ` +
                  `${idx % 2 === 0 ? "bg-content1/60" : "bg-content2/40"} ` +
                  `hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ` +
                  `${(() => {
                    const s = getStatus(tournament);
                    return s === TournamentStatus.Canceled
                      ? "border-l-4 border-l-danger"
                      : s === TournamentStatus.Completed
                        ? "border-l-4 border-l-success"
                        : s === TournamentStatus.InProgress
                          ? "border-l-4 border-l-primary"
                          : s === TournamentStatus.Open
                            ? "border-l-4 border-l-warning"
                            : "border-l-4 border-l-default-200";
                  })()}`
                }
                role="link"
                tabIndex={0}
                onClick={() => {
                  if (tournament.firestoreId) {
                    navigate(`/tournaments/${tournament.firestoreId}`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (tournament.firestoreId) {
                      navigate(`/tournaments/${tournament.firestoreId}`);
                    }
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
