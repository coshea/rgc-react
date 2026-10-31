import { useState, useEffect } from "react";
import { ListBox, Select, Spinner } from "@heroui/react";

import { TournamentStatusCard } from "@/components/tournament-status-card";
import { mapTournamentDoc } from "@/api/tournaments";
import { type Tournament } from "@/types/tournament";
import { db } from "@/config/firebase";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore";
import { EmptyStateMessage } from "@/components/empty-state-message";

// ─── Year options ─────────────────────────────────────────────────────────────

const FIRST_YEAR = 2020;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - FIRST_YEAR + 1 },
  (_, i) => CURRENT_YEAR - i,
);

// ─── Hook: real-time tournaments for a given year ─────────────────────────────

function useYearTournamentsRealtime(year: number) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const col = collection(db, "tournaments");
    const q = query(
      col,
      where("date", ">=", start),
      where("date", "<", end),
      orderBy("date", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTournaments(snap.docs.map(mapTournamentDoc));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [year]);

  return { tournaments, loading };
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TournamentStatusTab() {
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);

  const { tournaments, loading: isLoading } =
    useYearTournamentsRealtime(selectedYear);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          aria-label="Select year"
          value={String(selectedYear)}
          onChange={(key) => {
            if (key) setSelectedYear(Number(key));
          }}
          className="w-32"
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {YEAR_OPTIONS.map((y) => (
                <ListBox.Item
                  key={String(y)}
                  id={String(y)}
                  textValue={String(y)}
                >
                  {String(y)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <p className="text-sm text-muted">
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
        <EmptyStateMessage
          size="lg"
          icon="lucide:calendar-check"
          title={`No tournaments found for ${selectedYear}`}
        />
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
