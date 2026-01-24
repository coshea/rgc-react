import { TournamentStatus } from "@/types/tournament";

export type RegistrationDateInput =
  | Date
  | { toDate(): Date }
  | string
  | number
  | undefined;

export enum RegistrationWindowState {
  Unconfigured = "unconfigured",
  Invalid = "invalid",
  Upcoming = "upcoming",
  Open = "open",
  Closed = "closed",
}

type StatusInput = {
  status?: TournamentStatus | string;
  registrationStart?: RegistrationDateInput;
  registrationEnd?: RegistrationDateInput;
};

const MANUAL_OVERRIDE_STATUSES = new Set<TournamentStatus>([
  TournamentStatus.Canceled,
  TournamentStatus.Completed,
  TournamentStatus.InProgress,
]);

const hasToDate = (value: unknown): value is { toDate: () => Date } => {
  if (typeof value !== "object" || value === null) return false;
  if (!("toDate" in value)) return false;
  return typeof (value as Record<string, unknown>).toDate === "function";
};

export const parseToDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return undefined;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return undefined;
  }
  if (hasToDate(value)) {
    const maybeDate = value.toDate();
    if (maybeDate instanceof Date) return maybeDate;
  }
  return undefined;
};

export interface RegistrationWindowInfo {
  start?: Date;
  end?: Date;
  state: RegistrationWindowState;
}

export function getRegistrationWindowInfo(
  data: StatusInput,
  options?: { now?: Date },
): RegistrationWindowInfo {
  const start = parseToDate(data.registrationStart);
  const end = parseToDate(data.registrationEnd);
  const now = options?.now ?? new Date();

  if (!start && !end) {
    return { start, end, state: RegistrationWindowState.Unconfigured };
  }

  if (start && end && start.getTime() > end.getTime()) {
    return { start, end, state: RegistrationWindowState.Invalid };
  }

  if (start && now < start) {
    return { start, end, state: RegistrationWindowState.Upcoming };
  }

  if (end && now > end) {
    return { start, end, state: RegistrationWindowState.Closed };
  }

  return { start, end, state: RegistrationWindowState.Open };
}

export function isRegistrationOpen(
  data: StatusInput,
  options?: { now?: Date },
): boolean {
  return (
    getRegistrationWindowInfo(data, options).state ===
    RegistrationWindowState.Open
  );
}

export function isRegistrationUpcoming(
  data: StatusInput,
  options?: { now?: Date },
): boolean {
  return (
    getRegistrationWindowInfo(data, options).state ===
    RegistrationWindowState.Upcoming
  );
}

export function isRegistrationClosed(
  data: StatusInput,
  options?: { now?: Date },
): boolean {
  return (
    getRegistrationWindowInfo(data, options).state ===
    RegistrationWindowState.Closed
  );
}

export function getStatus(data: StatusInput): TournamentStatus {
  if (data.status) {
    const candidate = (
      Object.values(TournamentStatus) as TournamentStatus[]
    ).find((value) => value === data.status);
    if (candidate && MANUAL_OVERRIDE_STATUSES.has(candidate)) {
      return candidate;
    }
  }
  return TournamentStatus.Upcoming;
}

export function statusText(status: TournamentStatus): string {
  return status;
}
