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
      <Chip size={size} variant="tertiary">
        Completed
      </Chip>
    );
  }

  if (s === TournamentStatus.InProgress) {
    return (
      <Chip
        size={size}
        variant="primary"
        startContent={
          <Icon icon="lucide:play-circle" className="w-3.5 h-3.5" />
        }
      >
        In Progress
      </Chip>
    );
  }

  if (windowInfo.state === RegistrationWindowState.Open) {
    return (
      <Chip
        size={size}
        variant="primary"
        startContent={<Icon icon="lucide:user-plus" className="w-3.5 h-3.5" />}
        className="animate-pulse"
      >
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
        variant="primary"
        startContent={
          <Icon icon="lucide:calendar-clock" className="w-3.5 h-3.5" />
        }
      >
        Opens Soon
      </Chip>
    );
  }

  if (
    windowInfo.state === RegistrationWindowState.Closed ||
    windowInfo.state === RegistrationWindowState.Invalid
  ) {
    return (
      <Chip
        size={size}
        variant="tertiary"
        startContent={<Icon icon="lucide:lock" className="w-3.5 h-3.5" />}
      >
        Reg. Closed
      </Chip>
    );
  }

  // Default: upcoming tournament, registration not yet configured or far out
  return (
    <Chip
      size={size}
      variant="tertiary"
      startContent={
        <Icon icon="lucide:calendar-days" className="w-3.5 h-3.5" />
      }
    >
      Upcoming
    </Chip>
  );
}
