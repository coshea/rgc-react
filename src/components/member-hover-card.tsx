import { useMemo, type ReactNode } from "react";
import { Chip, Skeleton, buttonVariants } from "@heroui/react";
import { HoverCard } from "@heroui-pro/react/hover-card";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";

import { computeDisplayName, toDate } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { useUserChampionships } from "@/hooks/useChampionships";
import { useUserById } from "@/hooks/useUserById";
import { useYearlyWinnings } from "@/hooks/useYearlyWinnings";
import { useAuth } from "@/providers/AuthProvider";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";
import { BOARD_ROLE_META, formatBoardRoleLabel } from "@/types/roles";
import { rankStandings } from "@/utils/standings";

interface MemberHoverCardProps {
  /** The member's `users/{uid}` id. Without one, children render as-is. */
  userId?: string | null;
  children: ReactNode;
  /** Classes for the trigger wrapper (an inline-flex span). */
  className?: string;
}

/**
 * Mini profile for a member's avatar or name: hover (desktop), keyboard focus
 * or press-and-hold (touch) opens it. Members only, since `users` docs and
 * `/profile/:id` need sign-in; visitors just see the children. The profile is
 * fetched when the card first opens and cached by React Query.
 */
export function MemberHoverCard({
  userId,
  children,
  className,
}: MemberHoverCardProps) {
  const { userLoggedIn, loading } = useAuth();

  if (!userId || loading || !userLoggedIn) return <>{children}</>;

  return (
    <HoverCard openDelay={500}>
      <HoverCard.Trigger className={className}>{children}</HoverCard.Trigger>
      <HoverCard.Content
        placement="top"
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        <HoverCard.Arrow />
        <MemberHoverCardBody userId={userId} />
      </HoverCard.Content>
    </HoverCard>
  );
}

function roleMeta(role: string | null | undefined) {
  return role && role in BOARD_ROLE_META
    ? BOARD_ROLE_META[role as keyof typeof BOARD_ROLE_META]
    : null;
}

/** Championship chips shown before the rest collapse into "+N". */
const MAX_TROPHY_CHIPS = 2;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function championshipLabel(type: string) {
  return CHAMPIONSHIP_TYPES[type as keyof typeof CHAMPIONSHIP_TYPES] ?? type;
}

/**
 * This season's money list numbers for one member. `useYearlyWinnings` is
 * the money list's own query, cached under `['yearlyWinnings', year]`, so
 * every hover card on a page (and the money list itself) shares one load.
 * The rank is shown only in the top half, as in Season Wrapped.
 */
function useSeasonStats(userId: string, year: number) {
  const { winnings, isLoading } = useYearlyWinnings({ year });
  return useMemo(() => {
    const rows = rankStandings(winnings);
    const row = rows.find((r) => r.userId === userId);
    const inTopHalf = !!row && row.rank <= Math.ceil(rows.length / 2);
    return {
      isLoading,
      total: row?.total ?? 0,
      wins: row?.wins ?? 0,
      rankLabel: inTopHalf ? row.rankLabel : undefined,
    };
  }, [winnings, isLoading, userId]);
}

function StatCell({
  value,
  label,
  isEmpty,
  isLoading,
  extra,
}: {
  value: ReactNode;
  label: string;
  isEmpty: boolean;
  isLoading: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-auto flex-col items-center gap-0.5 px-2 text-center">
      {isLoading ? (
        <Skeleton className="my-0.5 h-5 w-10 rounded" />
      ) : (
        <span
          className={`whitespace-nowrap text-[17px] font-bold tabular-nums leading-6 ${isEmpty ? "text-muted" : ""}`}
        >
          {isEmpty ? "–" : value}
          {!isEmpty && extra}
        </span>
      )}
      <span className="whitespace-nowrap text-[11px] leading-tight text-muted">
        {label}
      </span>
    </div>
  );
}

/** Exported for tests; use `MemberHoverCard`. */
export function MemberHoverCardBody({ userId }: { userId: string }) {
  const { user, isLoading } = useUserById(userId);
  const year = new Date().getFullYear();
  const season = useSeasonStats(userId, year);
  const { championships, isLoading: championshipsLoading } =
    useUserChampionships({ userId });
  const titles = useMemo(
    () =>
      championships
        .filter((c) => c.winnerIds?.includes(userId))
        .sort((a, b) => b.year - a.year),
    [championships, userId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-3" aria-busy="true">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-muted">Profile unavailable</p>;
  }

  const name = computeDisplayName(user) || user.email || "Member";
  const meta = roleMeta(user.role);
  const memberSinceYear = toDate(user.createdAt)?.getUTCFullYear();
  const isChampion = titles.length > 0;
  const shownTitles = titles.slice(0, MAX_TROPHY_CHIPS);
  const moreTitles = titles.length - shownTitles.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <UserAvatar
            user={user}
            size="lg"
            className={`h-12 w-12 ${isChampion ? "ring-2 ring-warning ring-offset-2 ring-offset-overlay" : ""}`}
          />
          {isChampion && (
            <span className="absolute -bottom-1 -right-1.5 flex size-5.5 items-center justify-center rounded-full bg-warning text-warning-foreground ring-2 ring-overlay">
              <Icon
                icon="lucide:trophy"
                className="size-3"
                aria-label={championshipLabel(titles[0].championshipType)}
              />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate font-semibold leading-tight">{name}</p>
          <div className="flex flex-wrap gap-1">
            {user.boardMember && (
              <Chip
                size="sm"
                variant="tertiary"
                color={meta?.color ?? "secondary"}
              >
                <Icon
                  icon={meta?.icon ?? "lucide:shield"}
                  className="mr-0.5 inline-block h-3 w-3 align-[-1px]"
                />
                {formatBoardRoleLabel(user.role)}
              </Chip>
            )}
            {user.membershipType === "full" && (
              <Chip size="sm" variant="tertiary">
                Full Member
              </Chip>
            )}
            {user.membershipType === "handicap" && (
              <Chip size="sm" variant="tertiary">
                Handicap Only
              </Chip>
            )}
            {memberSinceYear && (
              <Chip size="sm" variant="tertiary">
                Since {memberSinceYear}
              </Chip>
            )}
          </div>
        </div>
      </div>

      {/* Columns size to their content so every label stays on one line. */}
      <div className="flex divide-x divide-separator rounded-xl bg-surface-secondary py-2.5">
        <StatCell
          label={`${year} winnings`}
          value={usd.format(season.total)}
          isEmpty={season.total <= 0}
          isLoading={season.isLoading}
          extra={
            season.rankLabel && (
              <span
                className="ml-1 text-xs font-normal text-muted"
                aria-label={`, number ${season.rankLabel} on the money list`}
              >
                #{season.rankLabel}
              </span>
            )
          }
        />
        <StatCell
          label={`${year} wins`}
          value={season.wins}
          isEmpty={season.wins === 0}
          isLoading={season.isLoading}
        />
        <StatCell
          label="Championships"
          value={titles.length}
          isEmpty={titles.length === 0}
          isLoading={championshipsLoading}
        />
      </div>

      {shownTitles.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Championships">
          {shownTitles.map((c) => (
            <li
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1.5 text-xs leading-none text-warning-soft-foreground"
            >
              <Icon icon="lucide:trophy" className="size-3.5" aria-hidden />
              {championshipLabel(c.championshipType)} · {c.year}
            </li>
          ))}
          {moreTitles > 0 && (
            <li className="inline-flex items-center rounded-full bg-default px-2.5 py-1.5 text-xs leading-none">
              +{moreTitles}
            </li>
          )}
        </ul>
      )}

      <RouterLink
        to={`/profile/${user.id}`}
        className={`${buttonVariants({ variant: "secondary", size: "sm", fullWidth: true })} h-11 sm:h-9`}
      >
        View profile
      </RouterLink>
    </div>
  );
}
