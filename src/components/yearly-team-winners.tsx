import { useMemo, useState } from "react";
import { Card, CardBody, Skeleton, Chip, Tooltip } from "@heroui/react";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { useAuth } from "@/providers/AuthProvider";
import { Icon } from "@iconify/react";
import { SearchInput } from "@/components/search-input";

interface Props {
  year: number;
}

interface TeamAggregate {
  key: string; // sorted joined userIds
  userIds: string[];
  displayNames: string[]; // best-effort composite names
  tournaments: {
    tournamentId: string;
    entryKey: string; // unique key per team entry per tournament/group/place
    title: string;
    date: Date;
    place: number;
    prizePerPlayer: number;
    score?: string;
  }[];
  wins: number; // count of 1st place finishes
  podiums: number; // finishes with place <= 3
  totalPerPlayer: number; // sum of prizePerPlayer per player
}

export function YearlyTeamWinners({ year }: Props) {
  const { userLoggedIn } = useAuth();
  const { tournaments, isLoading } = useYearlyTournaments({
    year,
    enabled: userLoggedIn,
  });

  const teams = useMemo<TeamAggregate[]>(() => {
    const map = new Map<string, TeamAggregate>();
    tournaments.forEach((t) => {
      if (t.winnerGroups && t.winnerGroups.length > 0) {
        // Prefer grouped winners model. Treat any place results with team size > 1 as a team entry
        t.winnerGroups.forEach((g: any) => {
          (g.winners || []).forEach((w: any) => {
            const competitors = w.competitors || [];
            if (competitors.length <= 1) return;
            const sorted = [...competitors].sort((a, b) =>
              a.userId.localeCompare(b.userId)
            );
            const userIds = sorted.map((c) => c.userId);
            const key = userIds.join("|");
            const existing = map.get(key);
            const groupKey = g?.id || g?.label || String(g?.order ?? "group");
            const entryKey = [
              t.firestoreId || "unknown",
              groupKey,
              String(w.place ?? ""),
              userIds.join(","),
            ].join("|");
            const entry = {
              tournamentId: t.firestoreId || "unknown",
              entryKey,
              title: t.title,
              date: t.date instanceof Date ? t.date : new Date(t.date),
              place: w.place as number,
              prizePerPlayer: (w.prizeAmount as number) || 0,
              score: w.score as string | undefined,
            };
            if (existing) {
              existing.tournaments.push(entry);
              if (w.place === 1) existing.wins += 1;
              if ((w.place as number) <= 3) existing.podiums += 1;
              existing.totalPerPlayer += (w.prizeAmount as number) || 0;
            } else {
              const names = sorted.map((c) => c.displayName || c.userId);
              map.set(key, {
                key,
                userIds,
                displayNames: names,
                tournaments: [entry],
                wins: w.place === 1 ? 1 : 0,
                podiums: (w.place as number) <= 3 ? 1 : 0,
                totalPerPlayer: (w.prizeAmount as number) || 0,
              });
            }
          });
        });
      }
    });

    const arr = Array.from(map.values());
    arr.forEach((team) => {
      team.tournaments.sort((a, b) => a.date.getTime() - b.date.getTime());
    });
    // sort by most amount won per person (desc) -> wins -> podiums -> team size (desc)
    arr.sort((a, b) => {
      if (b.totalPerPlayer !== a.totalPerPlayer)
        return b.totalPerPlayer - a.totalPerPlayer;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      return b.userIds.length - a.userIds.length;
    });
    return arr;
  }, [tournaments]);

  // Filter state must be declared before any early returns to maintain stable hook order
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (!filter.trim()) return teams;
    const q = filter.toLowerCase();
    return teams.filter((t) =>
      t.displayNames.join(" ").toLowerCase().includes(q)
    );
  }, [filter, teams]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:users" className="text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            {year} Team Performance
          </h2>
        </div>
        <div className="max-w-sm">
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Search player"
            ariaLabel="Search player"
            onClear={() => setFilter("")}
          />
        </div>
        <p className="text-xs text-default-500">
          {filter ? "No teams match filter." : `No team results for ${year}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon icon="lucide:users" className="text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">
          {year} Team Performance
        </h2>
        <span className="text-xs text-default-500">
          {filtered.length} team{filtered.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="max-w-sm">
        <SearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Search player"
          ariaLabel="Search player"
          onClear={() => setFilter("")}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((team) => (
          <Card
            key={team.key}
            className="border border-default-200/60 dark:border-default-100/10"
          >
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium leading-snug">
                    {team.displayNames.join(" • ")}
                  </p>
                  <p className="text-[11px] text-default-400 mt-1">
                    {team.wins} win
                    {team.wins !== 1 ? "s" : ""} • {team.podiums} podium
                    {team.podiums !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-default-500">
                  <span className="font-semibold text-default-700 dark:text-default-200">
                    ${team.totalPerPlayer.toLocaleString()}{" "}
                    <span className="text-[10px] font-normal">pp</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {team.tournaments.map((t) => {
                  let color: any =
                    t.place === 1
                      ? "success"
                      : t.place === 2
                        ? "warning"
                        : t.place === 3
                          ? "danger"
                          : "default";
                  return (
                    <Tooltip
                      key={t.entryKey}
                      content={`${t.title} • Place ${t.place} • $${t.prizePerPlayer} pp`}
                    >
                      <Chip
                        size="sm"
                        variant="flat"
                        color={color}
                        className="text-[10px] font-medium"
                      >
                        {t.title}: {t.place === 1 ? "🏆" : `P${t.place}`} $
                        {t.prizePerPlayer}
                      </Chip>
                    </Tooltip>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
