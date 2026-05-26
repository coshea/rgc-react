import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { TournamentStatus, type Tournament } from "@/types/tournament";
import {
  getRegistrationWindowInfo,
  RegistrationWindowState,
} from "@/utils/tournamentStatus";

interface TournamentStatusChipProps {
  tournament: Pick<
    Tournament,
    "status" | "registrationStart" | "registrationEnd"
  >;
  size?: "sm" | "md" | "lg";
}

export function TournamentStatusChip({
  tournament,
  size = "sm",
}: TournamentStatusChipProps) {
  const s = tournament.status ?? TournamentStatus.Upcoming;
  const windowInfo = getRegistrationWindowInfo(tournament);

  if (s === TournamentStatus.Canceled) {
    return (
      <Chip size={size} variant="tertiary">
        Canceled
      </Chip>
    );
  }

  if (s === TournamentStatus.Completed) {
    return (
      <Chip size={size} color="success" variant="tertiary">
        Completed
      </Chip>
    );
  }

  if (s === TournamentStatus.InProgress) {
    return (
      <Chip
        size={size}
        color="accent"
        variant="soft"
        className="whitespace-nowrap"
      >
        <Icon
          icon="lucide:play-circle"
          className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]"
        />
        In Progress
      </Chip>
    );
  }

  if (windowInfo.state === RegistrationWindowState.Open) {
    return (
      <Chip
        size={size}
        color="warning"
        variant="primary"
        className="animate-pulse whitespace-nowrap"
      >
        <Icon
          icon="lucide:user-plus"
          className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]"
        />
        Registration Open
      </Chip>
    );
  }

  if (
    windowInfo.state === RegistrationWindowState.Upcoming &&
    windowInfo.start != null &&
    windowInfo.start.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000
  ) {
    return (
      <Chip
        size={size}
        color="accent"
        variant="primary"
        className="whitespace-nowrap"
      >
        <Icon
          icon="lucide:calendar-clock"
          className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]"
        />
        Opens Soon
      </Chip>
    );
  }

  if (
    windowInfo.state === RegistrationWindowState.Closed ||
    windowInfo.state === RegistrationWindowState.Invalid
  ) {
    return (
      <Chip size={size} variant="tertiary" className="whitespace-nowrap">
        <Icon
          icon="lucide:lock"
          className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]"
        />
        Reg. Closed
      </Chip>
    );
  }

  // Default: upcoming tournament, registration not yet configured or far out
  return (
    <Chip size={size} variant="tertiary">
      <Icon
        icon="lucide:calendar-days"
        className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]"
      />
      Upcoming
    </Chip>
  );
}
