import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { TournamentStatus, type Tournament } from "@/types/tournament";
import {
  getRegistrationWindowInfo,
  RegistrationWindowState,
} from "@/utils/tournamentStatus";

type StatusInput = Pick<
  Tournament,
  "status" | "registrationStart" | "registrationEnd"
>;

interface TournamentStatusChipProps {
  tournament: StatusInput;
  size?: "sm" | "md" | "lg";
}

export enum DisplayStatus {
  Canceled = "canceled",
  Completed = "completed",
  InProgress = "in-progress",
  RegistrationOpen = "registration-open",
  OpensSoon = "opens-soon",
  RegistrationClosed = "registration-closed",
  Upcoming = "upcoming",
}

const OPENS_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function getDisplayStatus(tournament: StatusInput): DisplayStatus {
  const s = tournament.status ?? TournamentStatus.Upcoming;
  if (s === TournamentStatus.Canceled) return DisplayStatus.Canceled;
  if (s === TournamentStatus.Completed) return DisplayStatus.Completed;
  if (s === TournamentStatus.InProgress) return DisplayStatus.InProgress;

  const windowInfo = getRegistrationWindowInfo(tournament);
  if (windowInfo.state === RegistrationWindowState.Open) {
    return DisplayStatus.RegistrationOpen;
  }
  if (
    windowInfo.state === RegistrationWindowState.Upcoming &&
    windowInfo.start != null &&
    windowInfo.start.getTime() - Date.now() <= OPENS_SOON_WINDOW_MS
  ) {
    return DisplayStatus.OpensSoon;
  }
  if (
    windowInfo.state === RegistrationWindowState.Closed ||
    windowInfo.state === RegistrationWindowState.Invalid
  ) {
    return DisplayStatus.RegistrationClosed;
  }
  return DisplayStatus.Upcoming;
}

// Color scheme (one color per status, shared by chip and list accent bar):
//   Registration Open -> green (solid, pulsing)   Opens Soon  -> amber
//   Upcoming          -> blue                     Reg. Closed -> slate
//   In Progress       -> violet (solid)           Completed   -> teal
//   Canceled          -> red
interface StatusStyle {
  label: string;
  icon: string;
  chipClass: string;
  borderClass: string;
}

const STATUS_STYLES: Record<DisplayStatus, StatusStyle> = {
  [DisplayStatus.RegistrationOpen]: {
    label: "Registration Open",
    icon: "lucide:user-plus",
    chipClass: "bg-success text-success-foreground animate-pulse",
    borderClass: "border-l-success",
  },
  [DisplayStatus.OpensSoon]: {
    label: "Opens Soon",
    icon: "lucide:calendar-clock",
    chipClass: "bg-warning/15 text-warning",
    borderClass: "border-l-warning",
  },
  [DisplayStatus.Upcoming]: {
    label: "Upcoming",
    icon: "lucide:calendar-days",
    chipClass: "bg-accent/15 text-accent",
    borderClass: "border-l-accent",
  },
  [DisplayStatus.RegistrationClosed]: {
    label: "Reg. Closed",
    icon: "lucide:lock",
    chipClass: "bg-default text-muted",
    borderClass: "border-l-border",
  },
  [DisplayStatus.InProgress]: {
    label: "In Progress",
    icon: "lucide:play-circle",
    chipClass: "bg-violet-600 text-white dark:bg-violet-500",
    borderClass: "border-l-violet-500",
  },
  [DisplayStatus.Completed]: {
    label: "Completed",
    icon: "lucide:check-circle-2",
    chipClass: "bg-teal-600/15 text-teal-700 dark:text-teal-300",
    borderClass: "border-l-teal-500",
  },
  [DisplayStatus.Canceled]: {
    label: "Canceled",
    icon: "lucide:ban",
    chipClass: "bg-danger/15 text-danger",
    borderClass: "border-l-danger",
  },
};

export function getStatusBorderClass(tournament: StatusInput): string {
  return STATUS_STYLES[getDisplayStatus(tournament)].borderClass;
}

export function TournamentStatusChip({
  tournament,
  size = "sm",
}: TournamentStatusChipProps) {
  const style = STATUS_STYLES[getDisplayStatus(tournament)];
  return (
    <Chip
      size={size}
      variant="soft"
      className={`whitespace-nowrap ${style.chipClass}`}
    >
      <Icon
        icon={style.icon}
        className="inline-block w-3.5 h-3.5 mr-1 align-[-2px]"
      />
      {style.label}
    </Chip>
  );
}
