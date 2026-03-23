import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import {
  fetchAllRegistrations,
  mapTournamentDoc,
  onAllTournaments,
} from "@/api/tournaments";
import { TournamentStatus, type Tournament } from "@/types/tournament";
import {
  getRegistrationWindowInfo,
  RegistrationWindowState,
} from "@/utils/tournamentStatus";

// ─── Hook: real-time upcoming tournaments ─────────────────────────────────────

function useUpcomingTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAllTournaments(
      (snap: { docs: unknown[] }) => {
        const all = (snap.docs as Parameters<typeof mapTournamentDoc>[0][]).map(
          mapTournamentDoc,
        );
        setTournaments(
          all.filter(
            (t) =>
              t.status === TournamentStatus.Upcoming ||
              t.status === TournamentStatus.InProgress,
          ),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  return { tournaments, loading };
}

// ─── Tournament card ───────────────────────────────────────────────────────────

interface TournamentCardProps {
  tournament: Tournament;
}

function TournamentCard({ tournament }: TournamentCardProps) {
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["registrations", tournament.firestoreId],
    queryFn: () => fetchAllRegistrations(tournament.firestoreId!),
    enabled: Boolean(tournament.firestoreId),
    staleTime: 60_000,
  });

  const teamCount = registrations?.length ?? 0;
  const cap = tournament.maxTeams;
  const fillPct = cap && cap > 0 ? Math.min((teamCount / cap) * 100, 100) : 0;
  const isFull = cap !== undefined && teamCount >= cap;
  const isNearFull = cap !== undefined && !isFull && teamCount >= cap * 0.8;

  const registrationWindowInfo = getRegistrationWindowInfo(tournament);

  const fillColor = isFull
    ? ("danger" as const)
    : isNearFull
      ? ("warning" as const)
      : ("success" as const);

  const formattedDate = tournament.date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Card
      shadow="sm"
      as={tournament.firestoreId ? Link : undefined}
      to={
        tournament.firestoreId
          ? `/tournaments/${tournament.firestoreId}`
          : undefined
      }
      isPressable={Boolean(tournament.firestoreId)}
      isHoverable={Boolean(tournament.firestoreId)}
    >
      <CardHeader className="flex items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{tournament.title}</p>
          <p className="text-sm text-default-400 mt-0.5">{formattedDate}</p>
        </div>
        {(() => {
          const s = tournament.status ?? TournamentStatus.Upcoming;
          if (s === TournamentStatus.Canceled) {
            return (
              <Chip color="danger" size="sm" variant="flat">
                {s}
              </Chip>
            );
          }
          if (s === TournamentStatus.Completed) {
            return (
              <Chip color="success" size="sm" variant="flat">
                {s}
              </Chip>
            );
          }
          if (s === TournamentStatus.InProgress) {
            return (
              <Chip
                color="primary"
                size="sm"
                variant="solid"
                startContent={
                  <Icon icon="lucide:play-circle" className="w-3.5 h-3.5" />
                }
              >
                {s}
              </Chip>
            );
          }
          if (registrationWindowInfo.state === RegistrationWindowState.Open) {
            return (
              <Chip
                color="warning"
                size="sm"
                variant="solid"
                startContent={
                  <Icon icon="lucide:user-plus" className="w-3.5 h-3.5" />
                }
              >
                Registration Open
              </Chip>
            );
          }
          if (
            registrationWindowInfo.state === RegistrationWindowState.Upcoming
          ) {
            return (
              <Chip
                color="default"
                size="sm"
                variant="flat"
                startContent={
                  <Icon icon="lucide:calendar-clock" className="w-3.5 h-3.5" />
                }
              >
                Opens Soon
              </Chip>
            );
          }
          if (
            registrationWindowInfo.state === RegistrationWindowState.Closed ||
            registrationWindowInfo.state === RegistrationWindowState.Invalid
          ) {
            return (
              <Chip
                color="danger"
                size="sm"
                variant="bordered"
                startContent={
                  <Icon icon="lucide:lock" className="w-3.5 h-3.5" />
                }
              >
                Reg. Closed
              </Chip>
            );
          }
          return (
            <Chip
              color="default"
              size="sm"
              variant="flat"
              startContent={
                <Icon icon="lucide:calendar-days" className="w-3.5 h-3.5" />
              }
            >
              {s}
            </Chip>
          );
        })()}
      </CardHeader>
      <CardBody className="pt-0 space-y-3">
        <div className="flex items-center gap-4 text-sm text-default-500">
          <span className="flex items-center gap-1">
            <Icon icon="lucide:users" className="w-3.5 h-3.5" />
            {tournament.players}-player teams
          </span>
          {cap !== undefined && (
            <span className="flex items-center gap-1">
              <Icon icon="lucide:flag" className="w-3.5 h-3.5" />
              {cap} team cap
            </span>
          )}
        </div>

        {/* Registration fill rate */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-default-400">
            <Spinner size="sm" />
            Loading registrations…
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-default-600">Teams registered</span>
              <span className="font-semibold">
                {teamCount}
                {cap !== undefined && (
                  <span className="text-default-400 font-normal"> / {cap}</span>
                )}
                {isFull && (
                  <Chip
                    color="danger"
                    size="sm"
                    variant="flat"
                    className="ml-2 align-middle"
                  >
                    Full
                  </Chip>
                )}
                {isNearFull && !isFull && (
                  <Chip
                    color="warning"
                    size="sm"
                    variant="flat"
                    className="ml-2 align-middle"
                  >
                    Nearly full
                  </Chip>
                )}
              </span>
            </div>
            {cap !== undefined && cap > 0 && (
              <Progress
                color={fillColor}
                value={fillPct}
                size="sm"
                aria-label={`${teamCount} of ${cap} teams registered`}
              />
            )}
            {cap === undefined && teamCount > 0 && (
              <p className="text-xs text-default-400">No team cap set</p>
            )}
          </div>
        )}

        {/* Registration window */}
        {(tournament.registrationStart || tournament.registrationEnd) && (
          <div className="text-xs text-default-400 flex items-center gap-1">
            <Icon icon="lucide:calendar" className="w-3 h-3" />
            {tournament.registrationStart && (
              <span>
                Opens{" "}
                {tournament.registrationStart.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            )}
            {tournament.registrationStart && tournament.registrationEnd && (
              <span>·</span>
            )}
            {tournament.registrationEnd && (
              <span>
                Closes{" "}
                {tournament.registrationEnd.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </span>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TournamentStatusTab() {
  const { tournaments, loading } = useUpcomingTournaments();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">
          {loading
            ? "Loading…"
            : tournaments.length === 0
              ? "No upcoming tournaments."
              : `${tournaments.length} upcoming or in-progress tournament${
                  tournaments.length !== 1 ? "s" : ""
                }.`}
        </p>
        <Button
          size="sm"
          variant="flat"
          startContent={<Icon icon="lucide:refresh-cw" className="w-4 h-4" />}
          onPress={() => window.location.reload()}
          aria-label="Refresh tournament data"
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-default-400">
          <Icon icon="lucide:calendar-check" className="w-12 h-12 opacity-40" />
          <p className="text-sm">No upcoming or in-progress tournaments.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.firestoreId ?? t.title} tournament={t} />
          ))}
        </div>
      )}
    </div>
  );
}
