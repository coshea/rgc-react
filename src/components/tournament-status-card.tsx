import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Chip, Spinner } from "@heroui/react";
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

  const formattedDate = tournament.date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const cardBody = (
    <Card>
      <Card.Header className="pb-2">
        <div className="flex items-start justify-between gap-2 w-full">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{tournament.title}</p>
            <p className="text-sm text-muted mt-0.5">{formattedDate}</p>
          </div>
          <TournamentStatusChip tournament={tournament} />
        </div>
      </Card.Header>
      <Card.Content className="pt-0 space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted">
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
              <Icon icon="lucide:trophy" className="w-3.5 h-3.5 text-warning" />
              ${tournament.prizePool.toLocaleString()}
            </span>
          )}
        </div>
        {tournament.description && (
          <p className="text-xs text-muted line-clamp-2">
            {tournament.description}
          </p>
        )}

        {/* Registration fill rate — only shown to authenticated users */}
        {user && isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Spinner size="sm" />
            Loading registrations…
          </div>
        ) : user ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {tournament.players === 1
                  ? "Players registered"
                  : "Teams registered"}
              </span>
              <span className="font-semibold">
                {teamCount}
                {cap !== undefined && (
                  <span className="text-muted font-normal"> / {cap}</span>
                )}
                {!registrationClosed && isFull && (
                  <Chip
                    size="sm"
                    variant="tertiary"
                    className="ml-2 align-middle"
                  >
                    Full
                  </Chip>
                )}
                {!registrationClosed && isNearFull && !isFull && (
                  <Chip
                    size="sm"
                    variant="tertiary"
                    className="ml-2 align-middle"
                  >
                    Nearly full
                  </Chip>
                )}
              </span>
            </div>
            {!registrationClosed && cap !== undefined && cap > 0 && (
              <div
                role="progressbar"
                aria-label={`${teamCount} of ${cap} teams registered`}
                aria-valuenow={fillPct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full rounded-full bg-default/60 overflow-hidden"
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    isFull
                      ? "bg-danger"
                      : isNearFull
                        ? "bg-warning"
                        : "bg-success"
                  }`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            )}
          </div>
        ) : null}

        {/* Registration window */}
        {!registrationClosed &&
          (registrationWindowInfo.start || registrationWindowInfo.end) && (
            <div className="text-xs text-muted flex items-center gap-1">
              <Icon icon="lucide:calendar-clock" className="w-3 h-3" />
              <span className="font-medium text-muted">Registration:</span>
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
      </Card.Content>
    </Card>
  );

  if (!tournament.firestoreId) return cardBody;

  return (
    <Link
      to={`/tournaments/${tournament.firestoreId}`}
      className="block group"
      aria-label={`View details for ${tournament.title}`}
    >
      <div className="transition-transform group-hover:scale-[1.01]">
        {cardBody}
      </div>
    </Link>
  );
}
