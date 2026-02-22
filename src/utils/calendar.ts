import { Tournament } from "@/types/tournament";

const DEFAULT_CALENDAR_LOCATION = "Ridgefield Golf Course, Ridgefield, CT";

function toUtcDateStamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function toUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function nextUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function getTournamentGoogleCalendarUrl(
  tournament: Tournament,
  detailUrl: string,
): string {
  const start = toUtcDateStamp(tournament.date);
  const end = toUtcDateStamp(nextUtcDay(tournament.date));
  const description = tournament.description
    ? `${tournament.description}\n\n${detailUrl}`
    : detailUrl;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: tournament.title,
    dates: `${start}/${end}`,
    details: description,
    location: DEFAULT_CALENDAR_LOCATION,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadTournamentIcsFile(
  tournament: Tournament,
  detailUrl: string,
): void {
  const start = toUtcDateStamp(tournament.date);
  const end = toUtcDateStamp(nextUtcDay(tournament.date));
  const uidBase = tournament.firestoreId || `${tournament.title}-${start}`;
  const uid = `${uidBase}@ridgefield-golf-club`;
  const dtStamp = toUtcTimestamp(new Date());

  const description = tournament.description
    ? `${tournament.description}\n\n${detailUrl}`
    : detailUrl;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ridgefield Golf Club//Tournament Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcsText(tournament.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(DEFAULT_CALENDAR_LOCATION)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tournament.title.replace(/[^a-zA-Z0-9-_]+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
