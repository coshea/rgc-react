import React from "react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import type { Winner } from "@/types/winner";
import { useUsersMap } from "@/hooks/useUsers";
import { getPlaceMeta } from "@/utils/placeMeta";

export interface TournamentWinnersProps {
  winners: Winner[] | undefined | null;
  /** If true, show per-player avatars for each winner entry (when available) */
  showAvatars?: boolean;
  /** Optional custom className wrapper */
  className?: string;
  /** Whether to show prize amount "each" if present */
  showPrizeEach?: boolean;
  /** Show score segment if provided */
  showScore?: boolean;
  /** Heading level text prefix override (defaults to ordinal + colon) */
  labelFormatter?: (place: number, names: string[]) => string;
  /** Compact mode reduces padding & font sizes */
  compact?: boolean;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"]; // basic ordinal suffixes
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const TournamentWinners: React.FC<TournamentWinnersProps> = ({
  winners,
  showAvatars = false,
  className = "",
  showPrizeEach = true,
  showScore = true,
  labelFormatter,
  compact = false,
}) => {
  const { usersMap } = useUsersMap();
  const sorted = React.useMemo(
    () => (winners ? [...winners].sort((a, b) => a.place - b.place) : []),
    [winners]
  );

  if (!sorted.length)
    return (
      <p className="text-sm text-foreground-500">No winner data available.</p>
    );

  return (
    <div className={["space-y-3", className].filter(Boolean).join(" ")}>
      {sorted.map((w, idx) => {
        const iconMeta = getPlaceMeta(w.place);
        const label = labelFormatter
          ? labelFormatter(w.place, w.displayNames)
          : `${ordinal(w.place)}: ${w.displayNames.join(", ")}`;
        const prize =
          typeof w.prizeAmount === "number" && w.prizeAmount > 0
            ? `$${w.prizeAmount.toLocaleString()}` +
              (showPrizeEach ? " each" : "")
            : undefined;
        const score = showScore && w.score ? `Score: ${w.score}` : undefined;
        return (
          <div
            key={idx}
            className={[
              "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-md",
              compact ? "px-2 py-1.5 text-[13px]" : "px-3 py-2",
              "bg-content2",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon
                icon={iconMeta.icon}
                className={`w-4 h-4 ${iconMeta.colorClass}`}
              />
              <span
                className="font-medium whitespace-normal break-words sm:truncate"
                title={label}
              >
                {label}
              </span>
              {showAvatars && (
                <div className="flex -space-x-2 ml-1">
                  {w.userIds?.slice(0, 4).map((uid) => {
                    const user = usersMap.get(uid);
                    const name = user?.displayName || user?.email || uid;
                    return (
                      <UserAvatar
                        key={uid}
                        size="sm"
                        user={user}
                        name={user ? undefined : name}
                        className="ring-1 ring-background"
                      />
                    );
                  })}
                  {w.userIds && w.userIds.length > 4 && (
                    <span className="w-7 h-7 rounded-full bg-default-100 flex items-center justify-center text-[10px] font-medium ring-1 ring-default-200">
                      +{w.userIds.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground-500">
              {prize && <span>{prize}</span>}
              {score && <span>{score}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TournamentWinners;
