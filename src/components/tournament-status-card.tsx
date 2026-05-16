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
import { fetchRegistrationCount } from "@/api/tournaments";
import { type Tournament } from "@/types/tournament";
import {
  getRegistrationWindowInfo,
  RegistrationWindowState,
} from "@/utils/tournamentStatus";
import { TournamentStatusChip } from "@/components/tournament-status-chip";
import { useAuth } from "@/providers/AuthProvider";

interface TournamentStatusCardProps {
  tournament: Tournament;
}

export function TournamentStatusCard({
  tournament,
}: TournamentStatusCardProps) {
  const { user } = useAuth();
  const { data: teamCount = 0, isLoading } = useQuery({
    queryKey: ["registrationCount", tournament.firestoreId],
    queryFn: () => fetchRegistrationCount(tournament.firestoreId!),
    enabled: Boolean(tournament.firestoreId) && Boolean(user),
    staleTime: 60_000,
  });
  const cap = tournament.maxTeams;
  const fillPct = cap && cap > 0 ? Math.min((teamCount / cap) * 100, 100) : 0;
  const isFull = cap !== undefined && teamCount >= cap;
  const isNearFull = cap !== undefined && !isFull && teamCount >= cap * 0.8;

  const registrationWindowInfo = getRegistrationWindowInfo(tournament);
  const registrationClosed =
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
        <TournamentStatusChip tournament={tournament} />
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

        {/* Registration fill rate — only shown to authenticated users */}
        {user && isLoading ? (
          <div className="flex items-center gap-2 text-xs text-default-400">
            <Spinner size="sm" />
            Loading registrations…
          </div>
        ) : user ? (
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
                {!registrationClosed && isFull && (
                  <Chip
                    color="danger"
                    size="sm"
                    variant="flat"
                    className="ml-2 align-middle"
                  >
                    Full
                  </Chip>
                )}
                {!registrationClosed && isNearFull && !isFull && (
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
            {!registrationClosed && cap !== undefined && cap > 0 && (
              <Progress
                color={fillColor}
                value={fillPct}
                size="sm"
                aria-label={`${teamCount} of ${cap} teams registered`}
              />
            )}
          </div>
        ) : null}

        {/* Registration window */}
        {!registrationClosed &&
          (registrationWindowInfo.start || registrationWindowInfo.end) && (
            <div className="text-xs text-default-400 flex items-center gap-1">
              <Icon icon="lucide:calendar-clock" className="w-3 h-3" />
              <span className="font-medium text-default-500">
                Registration:
              </span>
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
