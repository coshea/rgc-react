import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useUsersMap } from "@/hooks/useUsers";
import { getPlaceMeta } from "@/utils/placeMeta";
import type { ReactNode } from "react";

interface Competitor {
  userId: string;
  displayName: string;
}

interface WinnerDisplayProps {
  place: number;
  competitors: Competitor[];
  score?: number | string;
  prize?: number;
  isChampion?: boolean;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const PlaceIndicator: React.FC<{ pos: number }> = ({ pos }) => {
  const meta = getPlaceMeta(pos);
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold min-w-[40px]"
      aria-label={`${ordinal(pos)} place`}
    >
      <Icon
        icon={meta.icon}
        className={["w-4 h-4", meta.colorClass].join(" ")}
      />
      <span className={meta.colorClass}>{ordinal(pos)}</span>
    </span>
  );
};

export function WinnerDisplay({
  place,
  competitors,
  score,
  prize,
  isChampion = false,
}: WinnerDisplayProps) {
  const { usersMap } = useUsersMap();

  const resolvedNames = competitors.map((c) => {
    const user = usersMap.get(c.userId);
    return user?.displayName || user?.email || c.displayName;
  });
  const nameList = resolvedNames.join(" • ");
  let nameContent: ReactNode;
  if (resolvedNames.length === 4) {
    const line1 = resolvedNames.slice(0, 2).join(" • ");
    const line2 = resolvedNames.slice(2).join(" • ");
    nameContent = (
      <>
        <span>{line1}</span>
        <br />
        <span>{line2}</span>
      </>
    );
  } else {
    nameContent = nameList;
  }

  const formatPrize = (amount: number) => `$${amount.toLocaleString()}`;

  return (
    <div
      className={
        "flex items-center gap-3 p-2 rounded-md bg-default-100/50 dark:bg-default-50/5" +
        (isChampion ? " ring-1 ring-amber-400/40 dark:ring-amber-300/30" : "")
      }
    >
      <PlaceIndicator pos={place} />
      {/* Desktop: avatars inline with names */}
      <div className="hidden sm:flex -space-x-2 rtl:space-x-reverse">
        {competitors.slice(0, 4).map((competitor) => {
          const user = usersMap.get(competitor.userId);
          const resolvedName =
            user?.displayName || user?.email || competitor.displayName;
          return (
            <UserAvatar
              key={competitor.userId}
              size="sm"
              className="ring-1 ring-background"
              name={resolvedName}
              user={user}
            />
          );
        })}
      </div>
      {/* Mobile: stack avatars above names */}
      <div className="flex-1 sm:hidden">
        <div className="flex justify-center -space-x-2 rtl:space-x-reverse mb-1.5">
          {competitors.slice(0, 4).map((competitor) => {
            const user = usersMap.get(competitor.userId);
            const resolvedName =
              user?.displayName || user?.email || competitor.displayName;
            return (
              <UserAvatar
                key={competitor.userId}
                size="sm"
                className="ring-1 ring-background"
                name={resolvedName}
                user={user}
              />
            );
          })}
        </div>
        <p
          className={
            "text-sm leading-snug text-center break-words" +
            (isChampion ? " font-semibold" : " font-medium")
          }
          title={nameList}
        >
          {nameContent}
        </p>
        <p className="text-[11px] text-default-500 text-center">
          {score !== undefined ? `Score: ${score}` : "—"}
          {prize && ` • ${formatPrize(prize)}`}
        </p>
      </div>
      {/* Desktop: names and info */}
      <div className="hidden sm:block flex-1 min-w-0">
        <p
          className={
            "text-sm leading-snug break-words" +
            (isChampion ? " font-semibold" : " font-medium")
          }
          title={nameList}
        >
          {nameContent}
        </p>
        <p className="text-[11px] text-default-500">
          {score !== undefined ? `Score: ${score}` : "—"}
          {prize && ` • ${formatPrize(prize)}`}
        </p>
      </div>
    </div>
  );
}
