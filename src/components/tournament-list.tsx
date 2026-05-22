import React from "react";
import { Table, Tooltip, Button, Label, ListBox, Select } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus, isRegistrationOpen } from "@/utils/tournamentStatus";
import { useNavigate } from "react-router-dom";
import { TeeBadge } from "@/components/tee-badge";
import { TournamentStatusChip } from "@/components/tournament-status-chip";
import { TournamentStatusCard } from "@/components/tournament-status-card";

interface TournamentListProps {
  tournaments: Tournament[];
}

type FilterStatus =
  | "all"
  | "completed"
  | "registration"
  | "scheduled"
  | "canceled";

export const TournamentList: React.FC<TournamentListProps> = ({
  tournaments,
}) => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");
  const [yearFilter, setYearFilter] = React.useState<number>(() =>
    new Date().getUTCFullYear(),
  );

  const availableYears = React.useMemo(() => {
    const years = new Set<number>();
    for (const t of tournaments) {
      if (t?.date instanceof Date) {
        years.add(t.date.getUTCFullYear());
      } else if (t?.date) {
        // Fallback in case date is serialized
        try {
          const d = new Date(t.date as unknown as string);
          if (!isNaN(d.getTime())) years.add(d.getUTCFullYear());
        } catch {
          // intentionally ignore invalid date values
        }
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [tournaments]);

  // Ensure selected year defaults to latest available and stays valid when list changes
  React.useEffect(() => {
    if (availableYears.length === 0) return;
    const latest = availableYears[0];
    if (!availableYears.includes(yearFilter)) {
      setYearFilter(latest);
    }
  }, [availableYears, yearFilter]);

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

  // First filter by year if selected
  const yearFilteredTournaments = React.useMemo(() => {
    return tournaments.filter((t) => {
      const d = t.date;
      return (
        d instanceof Date &&
        !isNaN(d.getTime()) &&
        d.getUTCFullYear() === yearFilter
      );
    });
  }, [tournaments, yearFilter]);

  // Then filter tournaments based on selected status
  const filteredTournaments = React.useMemo(() => {
    if (filterStatus === "all") return yearFilteredTournaments;

    return yearFilteredTournaments.filter((tournament) => {
      const status = getStatus(tournament);
      switch (filterStatus) {
        case "completed":
          return status === TournamentStatus.Completed;
        case "registration":
          return isRegistrationOpen(tournament);
        case "scheduled":
          return status === TournamentStatus.Upcoming;
        case "canceled":
          return status === TournamentStatus.Canceled;
        default:
          return true;
      }
    });
  }, [yearFilteredTournaments, filterStatus]);

  // Count tournaments for each filter
  const filterCounts = React.useMemo(() => {
    const counts = {
      all: yearFilteredTournaments.length,
      completed: 0,
      registration: 0,
      scheduled: 0,
      canceled: 0,
    };

    yearFilteredTournaments.forEach((tournament) => {
      const status = getStatus(tournament);
      if (status === TournamentStatus.Canceled) counts.canceled++;
      else if (status === TournamentStatus.Completed) counts.completed++;
      else if (isRegistrationOpen(tournament)) counts.registration++;
      else counts.scheduled++;
    });

    return counts;
  }, [yearFilteredTournaments]);

  // Card winners summary: simple first-place line from the lowest-order winner group
  const renderWinners = (tournament: Tournament) => {
    // Only show a summary when there are grouped winners and the event has results
    const status = getStatus(tournament);
    if (status !== TournamentStatus.Completed) return null;

    const groups = tournament.winnerGroups;

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
    const meta = metaBits.join(" • ");

    return (
      <div className="mt-2 text-xs text-muted flex items-start gap-1">
        <Icon icon="lucide:trophy" className="text-warning shrink-0 mt-0.5" />
        <div>
          <div>{names.join(", ")}</div>
          {meta ? <div className="text-muted">{meta}</div> : null}
        </div>
      </div>
    );
  };

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-12 bg-surface rounded-lg border">
        <Icon
          icon="lucide:calendar-off"
          className="mx-auto text-4xl text-muted mb-3"
        />
        <h3 className="text-lg font-medium text-foreground mb-1">
          No tournaments found
        </h3>
        <p className="text-muted">
          Create your first tournament to get started
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filters row */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterStatus === "all" ? "primary" : "tertiary"}
              size="sm"
              onPress={() => setFilterStatus("all")}
            >
              All ({filterCounts.all})
            </Button>
            <Button
              variant={filterStatus === "registration" ? "primary" : "tertiary"}
              size="sm"
              onPress={() => setFilterStatus("registration")}
            >
              <Icon icon="lucide:user-plus" className="w-4 h-4" />
              Registration Open ({filterCounts.registration})
            </Button>
            <Button
              variant={filterStatus === "scheduled" ? "primary" : "tertiary"}
              size="sm"
              onPress={() => setFilterStatus("scheduled")}
            >
              <Icon icon="lucide:calendar" className="w-4 h-4" />
              Scheduled ({filterCounts.scheduled})
            </Button>
            <Button
              variant={filterStatus === "completed" ? "primary" : "tertiary"}
              size="sm"
              onPress={() => setFilterStatus("completed")}
            >
              <Icon icon="lucide:check-circle" className="w-4 h-4" />
              Completed ({filterCounts.completed})
            </Button>
            {filterCounts.canceled > 0 && (
              <Button
                variant={filterStatus === "canceled" ? "danger" : "tertiary"}
                size="sm"
                onPress={() => setFilterStatus("canceled")}
              >
                <Icon icon="lucide:x-circle" className="w-4 h-4" />
                Canceled ({filterCounts.canceled})
              </Button>
            )}
          </div>
          <div className="min-w-32">
            <Select
              aria-label="Filter by year"
              value={
                availableYears.includes(yearFilter)
                  ? String(yearFilter)
                  : undefined
              }
              onChange={(key) => {
                if (key !== undefined && key !== null)
                  setYearFilter(Number(key));
              }}
              className="w-36"
              isDisabled={availableYears.length === 0}
            >
              <Label>Year</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {availableYears.map((y) => (
                    <ListBox.Item
                      key={String(y)}
                      id={String(y)}
                      textValue={String(y)}
                    >
                      {y}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>
      </div>
      {/* Mobile view (card-based layout) */}
      <div className="md:hidden space-y-2">
        {filteredTournaments.map((tournament) => (
          <TournamentStatusCard
            key={tournament.firestoreId}
            tournament={tournament}
          />
        ))}
      </div>

      {/* Desktop view (table layout) */}
      <div className="hidden md:block">
        <Table className="bg-surface rounded-lg border">
          <Table.Content
            aria-label="Tournaments list"
            onRowAction={(key) => {
              navigate(`/tournaments/${String(key)}`);
            }}
          >
            <Table.Header>
              <Table.Column>TOURNAMENT</Table.Column>
              <Table.Column>DATE</Table.Column>
              <Table.Column>
                <div className="flex items-center gap-1">
                  <Icon icon="lucide:clock" className="text-muted" />
                  <span className="sr-only">TEE TIMES</span>
                </div>
              </Table.Column>
              <Table.Column>PLAYERS</Table.Column>
              <Table.Column>TEE</Table.Column>
              <Table.Column>PRIZE POOL</Table.Column>
              <Table.Column>STATUS</Table.Column>
            </Table.Header>
            <Table.Body>
              {filteredTournaments.map((tournament, idx) => (
                <Table.Row
                  key={tournament.firestoreId}
                  id={tournament.firestoreId}
                  className={
                    `group transition-colors cursor-pointer ` +
                    `${idx % 2 === 0 ? "bg-surface/60" : "bg-surface-secondary/40"} ` +
                    `hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ` +
                    `${(() => {
                      const s = getStatus(tournament);
                      if (s === TournamentStatus.Canceled) {
                        return "border-l-4 border-l-danger";
                      }
                      if (s === TournamentStatus.Completed) {
                        return "border-l-4 border-l-success";
                      }
                      if (s === TournamentStatus.InProgress) {
                        return "border-l-4 border-l-accent";
                      }
                      if (isRegistrationOpen(tournament)) {
                        return "border-l-4 border-l-warning";
                      }
                      return "border-l-4 border-l-border";
                    })()}`
                  }
                  aria-label={`View details for ${tournament.title}`}
                >
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-foreground text-left flex items-center gap-2">
                          {tournament.title}
                        </p>
                        <p className="text-xs text-muted line-clamp-2 max-w-[200px]">
                          {tournament.description}
                        </p>
                        {renderWinners(tournament)}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon icon="lucide:calendar" className="text-muted" />
                      <span>{formatDate(tournament.date)}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {tournament.assignedTeeTimes ? (
                      <Tooltip>
                        <Tooltip.Trigger>
                          <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label="Assigned tee times"
                          >
                            <Icon icon="lucide:clock" className="text-accent" />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Assigned tee times</Tooltip.Content>
                      </Tooltip>
                    ) : (
                      <span className="text-muted/60">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <Icon icon="lucide:users" className="text-muted" />
                      <span>{tournament.players}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center">
                      <TeeBadge
                        tee={tournament.tee || "Mixed"}
                        size="sm"
                        ariaLabel={`${tournament.tee || "Mixed"} tee designation`}
                      />
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {formatCurrency(tournament.prizePool)}
                  </Table.Cell>
                  <Table.Cell>
                    <TournamentStatusChip tournament={tournament} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table>
      </div>
    </>
  );
};
