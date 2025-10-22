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
  groupType,
}: {
  place: WinnerPlace;
  displayPlace: number;
  groupType: string;
}) {
  const names = (place.competitors || []).map((c) => c.displayName);
  const prize =
    typeof place.prizeAmount === "number" && place.prizeAmount > 0
      ? `$${place.prizeAmount.toLocaleString()} each`
      : undefined;
  const score = place.score ? `Score: ${place.score}` : undefined;

  // For closest to pin, show hole number instead of place
  const isClosestToPin = groupType === "closestToPin";
  const label = isClosestToPin ? `Hole ${place.place}` : ordinal(displayPlace);
  const meta = isClosestToPin
    ? { icon: "lucide:target", colorClass: "text-primary" }
    : getPlaceMeta(place.place);

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-md px-3 py-2 bg-content2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon icon={meta.icon} className={`w-4 h-4 ${meta.colorClass}`} />
        <span
          className="font-medium whitespace-normal break-words sm:truncate"
          title={`${label}: ${names.join(", ")}`}
        >
          {label}: {names.join(", ")}
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

  const getGroupIcon = (group: WinnerGroup) => {
    switch (group.type) {
      case "closestToPin":
        return { icon: "lucide:target", colorClass: "text-primary" };
      case "day":
        return { icon: "lucide:calendar", colorClass: "text-warning" };
      case "overall":
        return { icon: "lucide:trophy", colorClass: "text-amber-500" };
      default:
        return { icon: "lucide:award", colorClass: "text-default-400" };
    }
  };

  return (
    <div className="space-y-5">
      {sorted.map((g) => {
        const groupIcon = getGroupIcon(g);
        return (
          <div key={g.id} className="space-y-2">
            <h4 className="text-base font-semibold flex items-center gap-2">
              <Icon
                icon={groupIcon.icon}
                className={`w-4 h-4 ${groupIcon.colorClass}`}
              />
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
                      groupType={g.type}
                    />
                  ));
                })()}
              </div>
            ) : (
              <div className="text-sm text-foreground-500">No places yet.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
