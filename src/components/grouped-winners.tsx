import { Icon } from "@iconify/react";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import { sortGroups, sortPlaces } from "@/utils/winners";

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function PlaceRow({ place }: { place: WinnerPlace }) {
  const names = (place.competitors || []).map((c) => c.displayName);
  const prize =
    typeof place.prizeAmount === "number" && place.prizeAmount > 0
      ? `$${place.prizeAmount.toLocaleString()} each`
      : undefined;
  const score = place.score ? `Score: ${place.score}` : undefined;
  const icon = place.place === 1 ? "lucide:trophy" : "lucide:medal";
  const color = place.place === 1 ? "text-warning" : "text-default-400";
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2 bg-content2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon icon={icon} className={`w-4 h-4 ${color}`} />
        <span
          className="font-medium truncate"
          title={`${ordinal(place.place)}: ${names.join(", ")}`}
        >
          {ordinal(place.place)}: {names.join(", ")}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-foreground-500 flex-shrink-0">
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
              {sortPlaces(g.winners).map((p) => (
                <PlaceRow key={p.place} place={p} />
              ))}
            </div>
          ) : (
            <div className="text-sm text-foreground-500">No places yet.</div>
          )}
        </div>
      ))}
    </div>
  );
}
