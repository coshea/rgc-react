import { Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";
import type { UserChampionship } from "@/hooks/useUserTournaments";

function championshipLabel(c: UserChampionship) {
  return (
    CHAMPIONSHIP_TYPES[c.championshipType as keyof typeof CHAMPIONSHIP_TYPES] ||
    c.tournamentName
  );
}

export function ProfileChampionships({
  championships,
  isLoading,
}: {
  championships: UserChampionship[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (championships.length === 0) {
    return <p className="py-2 text-sm text-muted">No championships yet.</p>;
  }

  const sorted = [...championships].sort((a, b) => b.year - a.year);

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((c) => {
        const isChampion = c.placement === "champion";
        return (
          <li
            key={c.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
              isChampion ? "bg-warning/10" : "bg-surface-secondary"
            }`}
          >
            <Icon
              icon={isChampion ? "lucide:crown" : "lucide:medal"}
              className={`h-5 w-5 shrink-0 ${isChampion ? "text-warning" : "text-muted"}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{championshipLabel(c)}</p>
              <p className="text-sm text-muted">
                {isChampion ? "Champion" : "Runner-up"}
              </p>
            </div>
            <span className="font-bold tabular-nums">{c.year}</span>
          </li>
        );
      })}
    </ul>
  );
}
