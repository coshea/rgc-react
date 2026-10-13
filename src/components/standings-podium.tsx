import { Button } from "@heroui/react";
import clsx from "clsx";
import { UserAvatar } from "@/components/avatar";
import { TrophyBadge } from "@/components/trophy-badge";
import type { User } from "@/api/users";
import { ordinal, type StandingsRow } from "@/utils/standings";

interface Props {
  /** Top of the standings, in earnings order. Only the first three are used. */
  rows: StandingsRow[];
  usersMap: Map<string, User>;
  onSelect: (userId: string) => void;
}

const formatMoney = (n: number) => `$${n.toLocaleString("en-US")}`;

// Step backgrounds by podium position (1st, 2nd, 3rd).
const STEP_TONES = [
  "bg-amber-100 dark:bg-amber-400/15",
  "bg-default",
  "bg-default/60",
];

export function StandingsPodium({ rows, usersMap, onSelect }: Props) {
  const top = rows.slice(0, 3);
  if (!top.length) return null;

  const leader = top[0];
  const nameOf = (r: StandingsRow) =>
    usersMap.get(r.userId)?.displayName || r.displayName;

  // Steps are drawn 2nd, 1st, 3rd, like a real podium.
  const order = [top[1], top[0], top[2]].filter(
    (r): r is StandingsRow => !!r,
  );

  let caption = `${nameOf(leader)} leads.`;
  if (top[1]) {
    caption =
      top[1].total === leader.total
        ? `${nameOf(leader)} and ${nameOf(top[1])} are tied for the lead.`
        : `${nameOf(leader)} leads by ${formatMoney(leader.total - top[1].total)}.`;
  }

  return (
    <section
      aria-label="Top three"
      className="rounded-lg border border-separator bg-surface px-3 pt-4 md:px-5"
    >
      <div className="flex items-end justify-center gap-2 md:gap-3 border-b-2 border-foreground">
        {order.map((r) => {
          const position = top.indexOf(r);
          const user = usersMap.get(r.userId);
          const name = nameOf(r);
          // Step height follows earnings so the gap between players shows.
          // A floor keeps a small total from collapsing the step.
          const heightPct = Math.max(
            35,
            leader.total > 0 ? (r.total / leader.total) * 100 : 100,
          );
          return (
            <Button
              key={r.userId}
              variant="ghost"
              onPress={() => onSelect(r.userId)}
              aria-label={`${ordinal(r.rank)}, ${name}, ${formatMoney(r.total)}. Show breakdown`}
              className="h-auto min-w-0 flex-1 md:flex-none md:w-36 flex-col items-center gap-1 rounded-b-none px-1 pt-2 pb-0 font-normal whitespace-normal"
            >
              <UserAvatar
                size={position === 0 ? "md" : "sm"}
                user={user}
                name={user ? undefined : r.displayName}
                className={
                  position === 0
                    ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-surface"
                    : undefined
                }
              />
              <span className="text-sm leading-tight text-center wrap-break-word">
                {name}
              </span>
              <span
                className={clsx(
                  "tabular-nums font-semibold leading-none",
                  position === 0 ? "text-xl md:text-2xl" : "text-lg md:text-xl",
                )}
              >
                {formatMoney(r.total)}
              </span>
              <span className="mt-1 flex h-24 md:h-32 w-full items-end">
                {/* Data-driven height, so it can't be a Tailwind class. */}
                <span
                  style={{ height: `${heightPct}%` }}
                  className={clsx(
                    "flex w-full flex-col items-center gap-1 rounded-t pt-2",
                    STEP_TONES[position],
                  )}
                >
                  <TrophyBadge rank={r.rank} size={position === 0 ? "md" : "sm"} />
                  <span
                    className={clsx(
                      "tabular-nums font-semibold",
                      position === 0 ? "text-2xl text-warning" : "text-xl",
                    )}
                  >
                    {r.rankLabel}
                  </span>
                </span>
              </span>
            </Button>
          );
        })}
      </div>
      <p className="py-3 text-center text-sm text-muted">{caption}</p>
    </section>
  );
}
