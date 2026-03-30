import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { TeeBadge } from "@/components/tee-badge";
import {
  fetchRegistrationCount,
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
  const { data: teamCount = 0, isLoading } = useQuery({
    queryKey: ["registrationCount", tournament.firestoreId],
    queryFn: () => fetchRegistrationCount(tournament.firestoreId!),
    enabled: Boolean(tournament.firestoreId),
    staleTime: 60_000,
  });
  const cap = tournament.maxTeams;
  const fillPct = cap && cap > 0 ? Math.min((teamCount / cap) * 100, 100) : 0;
  const isFull = cap !== undefined && teamCount >= cap;
  const isNearFull = cap !== undefined && !isFull && teamCount >= cap * 0.8;

  const registrationWindowInfo = getRegistrationWindowInfo(tournament);

  const showRegistrationCount =
    tournament.status === TournamentStatus.InProgress ||
    registrationWindowInfo.state === RegistrationWindowState.Open ||
    registrationWindowInfo.state === RegistrationWindowState.Closed;

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
          <p className="font-semibold leading-snug">{tournament.title}</p>
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
            registrationWindowInfo.state === RegistrationWindowState.Upcoming &&
            registrationWindowInfo.start != null &&
            registrationWindowInfo.start.getTime() - Date.now() <=
              7 * 24 * 60 * 60 * 1000
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
          {tournament.tee && (
            <span className="flex items-center gap-1">
              <TeeBadge
                tee={tournament.tee}
                size="xs"
                ariaLabel={`Tee: ${tournament.tee}`}
              />
            </span>
          )}
          {tournament.prizePool > 0 && (
            <span className="flex items-center gap-1">
              <Icon
                icon="lucide:trophy"
                className="w-3.5 h-3.5 text-warning-500"
              />
              ${tournament.prizePool.toLocaleString()}
            </span>
          )}
        </div>
        {tournament.description && (
          <p className="text-xs text-default-500 line-clamp-2">
            {tournament.description}
          </p>
        )}

        {/* Registration fill rate */}
        {showRegistrationCount && isLoading ? (
          <div className="flex items-center gap-2 text-xs text-default-400">
            <Spinner size="sm" />
            Loading registrations…
          </div>
        ) : showRegistrationCount ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-default-600">
                {tournament.players === 1
                  ? "Players registered"
                  : "Teams registered"}
              </span>
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
        ) : null}

        {/* Registration window */}
        {(registrationWindowInfo.start || registrationWindowInfo.end) && (
          <div className="text-xs text-default-400 flex items-center gap-1">
            <Icon icon="lucide:calendar" className="w-3 h-3" />
            <span className="font-medium text-default-500">Registration:</span>
            {registrationWindowInfo.start && (
              <span>
                Opens{" "}
                {registrationWindowInfo.start.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {registrationWindowInfo.start && registrationWindowInfo.end && (
              <span>·</span>
            )}
            {registrationWindowInfo.end && (
              <span>
                Closes{" "}
                {registrationWindowInfo.end.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
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
      <p className="text-sm text-default-500">
        {loading
          ? "Loading…"
          : tournaments.length === 0
            ? "No upcoming tournaments."
            : `${tournaments.length} upcoming or in-progress tournament${
                tournaments.length !== 1 ? "s" : ""
              }.`}
      </p>

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
