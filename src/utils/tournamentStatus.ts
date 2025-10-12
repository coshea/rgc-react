import { TournamentStatus } from "@/types/tournament";

export function flagsToStatus(flags: {
  completed?: boolean;
  canceled?: boolean;
  registrationOpen?: boolean;
}): TournamentStatus {
  if (flags.canceled) return TournamentStatus.Canceled;
  if (flags.completed) return TournamentStatus.Completed;
  if (flags.registrationOpen) return TournamentStatus.Open;
  return TournamentStatus.Upcoming;
}

export function statusToFlags(status: TournamentStatus): {
  completed: boolean;
  canceled: boolean;
  registrationOpen: boolean;
} {
  switch (status) {
    case TournamentStatus.Canceled:
      return { completed: false, canceled: true, registrationOpen: false };
    case TournamentStatus.Completed:
      return { completed: true, canceled: false, registrationOpen: false };
    case TournamentStatus.InProgress:
      // In progress has no legacy boolean equivalent; all flags false
      return { completed: false, canceled: false, registrationOpen: false };
    case TournamentStatus.Open:
      return { completed: false, canceled: false, registrationOpen: true };
    case TournamentStatus.Upcoming:
    default:
      return { completed: false, canceled: false, registrationOpen: false };
  }
}

export function getStatus(t: {
  status?: TournamentStatus;
  completed?: boolean;
  canceled?: boolean;
  registrationOpen?: boolean;
}): TournamentStatus {
  if (t.status) return t.status;
  return flagsToStatus({
    completed: !!t.completed,
    canceled: !!t.canceled,
    registrationOpen: !!t.registrationOpen,
  });
}
