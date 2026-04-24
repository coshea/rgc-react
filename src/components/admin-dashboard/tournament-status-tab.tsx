import { useState } from "react";
import { Select, SelectItem, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { TournamentStatusCard } from "@/components/tournament-status-card";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";

// ─── Year options ─────────────────────────────────────────────────────────────

const FIRST_YEAR = 2020;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - FIRST_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
);

// ─── Main component ────────────────────────────────────────────────────────────

export function TournamentStatusTab() {
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);

  const { tournaments, isLoading } = useYearlyTournaments({
    year: selectedYear,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          aria-label="Select year"
          selectedKeys={[String(selectedYear)]}
          onSelectionChange={(keys) => {
            const val = Array.from(keys)[0];
            if (val) setSelectedYear(Number(val));
          }}
          className="w-32"
          size="sm"
        >
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={String(y)}>{String(y)}</SelectItem>
          ))}
        </Select>
        <p className="text-sm text-default-500">
          {isLoading
            ? "Loading…"
            : tournaments.length === 0
              ? `No tournaments in ${selectedYear}.`
              : `${tournaments.length} tournament${tournaments.length !== 1 ? "s" : ""} in ${selectedYear}.`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-default-400">
          <Icon icon="lucide:calendar-check" className="w-12 h-12 opacity-40" />
          <p className="text-sm">No tournaments found for {selectedYear}.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentStatusCard
              key={t.firestoreId ?? t.title}
              tournament={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}
