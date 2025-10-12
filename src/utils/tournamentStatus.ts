import type { TournamentStatus } from "@/types/tournament";

export function flagsToStatus(flags: {
  completed?: boolean;
  canceled?: boolean;
  registrationOpen?: boolean;
}): TournamentStatus {
  if (flags.canceled) return "canceled";
  if (flags.completed) return "completed";
  if (flags.registrationOpen) return "open";
  return "upcoming";
}

export function statusToFlags(status: TournamentStatus): {
  completed: boolean;
  canceled: boolean;
  registrationOpen: boolean;
} {
  switch (status) {
    case "canceled":
      return { completed: false, canceled: true, registrationOpen: false };
    case "completed":
      return { completed: true, canceled: false, registrationOpen: false };
    case "open":
      return { completed: false, canceled: false, registrationOpen: true };
    case "upcoming":
    default:
      return { completed: false, canceled: false, registrationOpen: false };
  }
}
