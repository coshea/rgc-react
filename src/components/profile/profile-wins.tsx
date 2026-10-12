import { Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { UserTournamentWin } from "@/hooks/useUserTournaments";
import { getPlaceMeta } from "@/utils/placeMeta";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  // Tournament dates are stored as midnight UTC.
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}

function sortByDateDesc(wins: UserTournamentWin[]) {
  return [...wins].sort((a, b) => b.date.localeCompare(a.date));
}

function formatPrize(amount: number) {
  return `$${amount.toLocaleString()}`;
}

/** Trophy colors for the podium; the number underneath keeps them distinct without color. */
const TROPHY_STYLES: Record<number, { box: string; icon: string; label: string }> =
  {
    1: {
      box: "bg-amber-100 dark:bg-amber-400/15",
      icon: "text-amber-500 dark:text-amber-300",
      label: "text-amber-900 dark:text-amber-200",
    },
    2: {
      box: "bg-slate-100 dark:bg-slate-400/15",
      icon: "text-slate-400 dark:text-slate-300",
      label: "text-slate-700 dark:text-slate-200",
    },
    3: {
      box: "bg-orange-100 dark:bg-orange-400/15",
      icon: "text-orange-700 dark:text-orange-300",
      label: "text-orange-900 dark:text-orange-200",
    },
  };

/** Leaderboard-style finish: a gold/silver/bronze trophy for the podium, a badge otherwise. */
function PlaceBadge({ position }: { position?: number }) {
  if (!position) {
    return <span className="h-11 w-11 shrink-0" aria-hidden="true" />;
  }

  const trophy = TROPHY_STYLES[position];
  if (trophy) {
    return (
      <span
        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ${trophy.box}`}
        role="img"
        aria-label={`${ordinal(position)} place`}
      >
        <Icon icon="lucide:trophy" className={`h-5 w-5 ${trophy.icon}`} />
        <span
          className={`text-[11px] font-bold leading-none tabular-nums ${trophy.label}`}
        >
          {ordinal(position)}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${getPlaceMeta(position).badgeBg}`}
      aria-label={`${ordinal(position)} place`}
    >
      {ordinal(position)}
    </span>
  );
}

function WinRow({
  win,
  showYear,
}: {
  win: UserTournamentWin;
  showYear: boolean;
}) {
  const when = showYear
    ? `${dayLabel(win.date)}, ${win.year}`
    : dayLabel(win.date);
  return (
    <li className="group/row flex min-h-15 items-center gap-3">
      <PlaceBadge position={win.position} />
      <div className="min-w-0 flex-1 self-stretch border-b border-border py-2.5 group-last/row:border-b-0">
        <div className="flex h-full items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{win.tournamentName}</p>
            {when && <p className="text-sm text-muted">{when}</p>}
          </div>
          <span className="shrink-0 font-semibold tabular-nums">
            {formatPrize(win.prize ?? 0)}
          </span>
        </div>
      </div>
    </li>
  );
}

function WinsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Every win in the given year, newest first, for the Overview tab. */
export function RecentWins({
  wins,
  isLoading,
  year,
}: {
  wins: UserTournamentWin[];
  isLoading: boolean;
  year: number;
}) {
  if (isLoading) return <WinsSkeleton rows={3} />;
  const yearWins = sortByDateDesc(wins.filter((w) => w.year === year));
  if (yearWins.length === 0) {
    return <p className="py-2 text-sm text-muted">No wins yet in {year}.</p>;
  }
  return (
    <ul>
      {yearWins.map((win) => (
        <WinRow key={win.id} win={win} showYear={false} />
      ))}
    </ul>
  );
}

/** Every win, grouped by year, for the Wins tab. */
export function WinsByYear({
  wins,
  isLoading,
}: {
  wins: UserTournamentWin[];
  isLoading: boolean;
}) {
  if (isLoading) return <WinsSkeleton rows={4} />;
  if (wins.length === 0) {
    return (
      <p className="py-8 text-center text-muted">No tournament wins yet.</p>
    );
  }

  const byYear = new Map<number, UserTournamentWin[]>();
  for (const win of sortByDateDesc(wins)) {
    byYear.set(win.year, [...(byYear.get(win.year) ?? []), win]);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(byYear.entries())
        .sort(([a], [b]) => b - a)
        .map(([year, yearWins]) => {
          const total = yearWins.reduce((sum, w) => sum + (w.prize ?? 0), 0);
          return (
            <section key={year} aria-label={`${year} wins`}>
              <div className="flex items-end justify-between gap-3 px-1 pb-2">
                <div>
                  <h3 className="text-xl font-bold leading-none tabular-nums">
                    {year}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {yearWins.length} win{yearWins.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-xl font-bold leading-none tabular-nums">
                  {formatPrize(total)}
                </p>
              </div>
              <ul className="rounded-xl bg-surface-secondary/60 px-3">
                {yearWins.map((win) => (
                  <WinRow key={win.id} win={win} showYear={false} />
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
