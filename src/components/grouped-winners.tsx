import { Icon } from "@iconify/react";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import { sortGroups, sortPlaces, computeDisplayPlaces } from "@/utils/winners";
import { getPlaceMeta } from "@/utils/placeMeta";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function PlaceRow({
  place,
  displayPlace,
}: {
  place: WinnerPlace;
  displayPlace: number;
}) {
  const names = (place.competitors || []).map((c) => c.displayName);
  const prize =
    typeof place.prizeAmount === "number" && place.prizeAmount > 0
      ? `$${place.prizeAmount.toLocaleString()} each`
      : undefined;
  const score = place.score ? `Score: ${place.score}` : undefined;
  const meta = getPlaceMeta(place.place);
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-md px-3 py-2 bg-content2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon icon={meta.icon} className={`w-4 h-4 ${meta.colorClass}`} />
        <span
          className="font-medium whitespace-normal break-words sm:truncate"
          title={`${ordinal(displayPlace)}: ${names.join(", ")}`}
        >
          {ordinal(displayPlace)}: {names.join(", ")}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-foreground-500">
        {prize && <span>{prize}</span>}
        {score && <span>{score}</span>}
      </div>
    </div>
  );
}

export default function GroupedWinners({ groups }: { groups: WinnerGroup[] }) {
  const sorted = sortGroups(groups);
  if (!sorted.length)
    return (
      <p className="text-sm text-foreground-500">No winner data available.</p>
    );
  return (
    <div className="space-y-5">
      {sorted.map((g) => (
        <div key={g.id} className="space-y-2">
          <h4 className="text-base font-semibold flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-default-400" />
            {g.label}
          </h4>
          {g.winners?.length ? (
            <div className="space-y-2">
              {(() => {
                const sorted = sortPlaces(g.winners);
                const display = computeDisplayPlaces(sorted);
                return sorted.map((p, idx) => (
                  <PlaceRow
                    key={p.id || `${p.place}-${idx}`}
                    place={p}
                    displayPlace={display[idx].displayPlace}
                  />
                ));
              })()}
            </div>
          ) : (
            <div className="text-sm text-foreground-500">No places yet.</div>
          )}
        </div>
      ))}
    </div>
  );
}
