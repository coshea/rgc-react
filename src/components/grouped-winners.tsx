import { Icon } from "@iconify/react";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import { sortGroups, sortPlaces } from "@/utils/winners";
import { WinnerDisplay } from "@/components/winner-display";

function PlaceRow({
  place,
  groupType,
}: {
  place: WinnerPlace;
  displayPlace: number;
  groupType: string;
}) {
  const isChampion = place.place === 1 && groupType === "overall";
  const prize =
    typeof place.prizeAmount === "number" && place.prizeAmount > 0
      ? place.prizeAmount
      : undefined;

  return (
    <WinnerDisplay
      place={place.place}
      competitors={place.competitors || []}
      score={place.score}
      prize={prize}
      isChampion={isChampion}
    />
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
                  return sorted.map((p, idx) => (
                    <PlaceRow
                      key={p.id || `${p.place}-${idx}`}
                      place={p}
                      displayPlace={p.place}
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
