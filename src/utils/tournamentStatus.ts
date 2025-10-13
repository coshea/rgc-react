import { TournamentStatus } from "@/types/tournament";

// Unified status accessor: rely solely on explicit status, default to Upcoming when absent.
export function getStatus(t: { status?: TournamentStatus }): TournamentStatus {
  return t.status ?? TournamentStatus.Upcoming;
}

// Consistent display text for status across the app: use the enum's string value
export function statusText(status: TournamentStatus): string {
  return status;
}
