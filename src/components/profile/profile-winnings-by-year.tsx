import { Skeleton } from "@heroui/react";
import type { UserWinnings } from "@/hooks/useUserTournaments";

/** Horizontal bars for the last few seasons' winnings. */
export function WinningsByYear({
  winnings,
  isLoading,
  limit = 4,
}: {
  winnings: UserWinnings | undefined;
  isLoading: boolean;
  limit?: number;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: limit }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full rounded" />
        ))}
      </div>
    );
  }

  const years = (winnings?.yearly ?? []).slice(0, limit);
  if (years.length === 0) {
    return <p className="py-2 text-sm text-muted">No winnings yet.</p>;
  }
  const max = Math.max(...years.map((y) => y.amount), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {years.map(({ year, amount }) => (
        <li
          key={year}
          className="grid grid-cols-[2.75rem_minmax(0,1fr)_4.5rem] items-center gap-2.5 text-sm"
        >
          <span className="text-muted">{year}</span>
          <div
            className="h-2 rounded-full bg-surface-secondary"
            role="presentation"
          >
            {/* Width is data-driven, so it can't be a static Tailwind class. */}
            <div
              className="h-2 rounded-full bg-success"
              style={{ width: `${Math.round((amount / max) * 100)}%` }}
            />
          </div>
          <span className="text-right font-semibold tabular-nums">
            ${amount.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
