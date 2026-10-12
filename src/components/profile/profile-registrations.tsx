import { Button, Card, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";
import { TeamRegistrationCard } from "@/components/team-registration-card";
import type { UserRegistrationWithTournament } from "@/api/tournaments";
import type { User } from "@/api/users";

type RegistrationsState = {
  registrations: UserRegistrationWithTournament[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

function tournamentLink(r: UserRegistrationWithTournament) {
  return `/tournaments/${r.tournament.firestoreId}`;
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-muted">Couldn&apos;t load registrations.</p>
      <Button variant="tertiary" size="sm" onPress={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Teammates other than the profile owner, e.g. "with J. Alvarez". */
function teammatesLabel(r: UserRegistrationWithTournament, profileId: string) {
  const others = r.registration.team
    .filter((m) => m.id !== profileId)
    .map((m) => m.displayName);
  return others.length ? `with ${others.join(", ")}` : "";
}

/** The soonest registration, as a compact row for the Overview tab. */
export function NextRegistration({
  profileId,
  registrations,
  isLoading,
  isError,
  onRetry,
}: RegistrationsState & { profileId: string }) {
  if (isLoading) return <Skeleton className="h-14 w-full rounded-xl" />;
  if (isError) return <ErrorState onRetry={onRetry} />;

  const next = registrations[0];
  if (!next) {
    return (
      <p className="py-2 text-sm text-muted">
        Not registered for any upcoming tournaments.
      </p>
    );
  }

  const { tournament } = next;
  const month = tournament.date
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  const day = tournament.date.toLocaleDateString("en-US", {
    day: "numeric",
    timeZone: "UTC",
  });
  const goldTee = next.registration.team.some(
    (m) => m.id === profileId && m.goldTee,
  );
  const detail = [teammatesLabel(next, profileId), goldTee ? "Gold tees" : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <RouterLink
      to={tournamentLink(next)}
      className="flex min-h-14 items-center gap-3 rounded-xl text-foreground hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent"
      aria-label={`View details for ${tournament.title}`}
    >
      <div className="flex h-13 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-secondary">
        <span className="text-[11px] font-bold text-danger">{month}</span>
        <span className="text-lg font-bold leading-none">{day}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{tournament.title}</p>
        {detail && <p className="truncate text-sm text-muted">{detail}</p>}
      </div>
      <Icon
        icon="lucide:chevron-right"
        className="h-4 w-4 shrink-0 text-muted"
        aria-hidden="true"
      />
    </RouterLink>
  );
}

/** Every upcoming registration with its full team, for the Upcoming tab. */
export function RegistrationList({
  registrations,
  isLoading,
  isError,
  onRetry,
  usersMap,
}: RegistrationsState & { usersMap: Map<string, User> }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (registrations.length === 0) {
    return (
      <div className="py-8 text-center">
        <Icon
          icon="lucide:calendar-x"
          className="mx-auto mb-3 h-10 w-10 text-muted"
        />
        <p className="text-muted">Not registered for any upcoming tournaments</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {registrations.map((r) => {
        const { registration, tournament } = r;
        const maxPlayers = tournament.players ?? 1;
        const openSpots = Math.max(0, maxPlayers - registration.team.length);
        const regDate = registration.registeredAt;
        return (
          <RouterLink
            key={`${tournament.firestoreId}-${registration.id}`}
            to={tournamentLink(r)}
            className="block"
            aria-label={`View details for ${tournament.title}`}
          >
            <Card className="border transition-colors hover:border-accent/40">
              <Card.Header className="pb-1">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate font-semibold">{tournament.title}</p>
                  <Chip size="sm" variant="tertiary" color="success">
                    Registered
                  </Chip>
                </div>
                <p className="text-xs text-muted">
                  {tournament.date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              </Card.Header>
              <Card.Content className="px-2 pt-0 pb-2">
                <TeamRegistrationCard
                  teamNumber={1}
                  displayTeam={registration.team}
                  leaderId={registration.ownerId}
                  isWaitlisted={false}
                  openSpots={openSpots}
                  showOpenSpots={
                    registration.openSpotsOptIn === true && openSpots > 0
                  }
                  dateStr={
                    regDate
                      ? `Registered ${regDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                      : ""
                  }
                  maxPlayers={maxPlayers}
                  usersMap={usersMap}
                />
              </Card.Content>
            </Card>
          </RouterLink>
        );
      })}
    </div>
  );
}
