import type { ReactNode } from "react";
import { Chip, Skeleton, buttonVariants } from "@heroui/react";
import { HoverCard } from "@heroui-pro/react/hover-card";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";

import { computeDisplayName, toDate } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { useUserById } from "@/hooks/useUserById";
import { useAuth } from "@/providers/AuthProvider";
import { BOARD_ROLE_META, formatBoardRoleLabel } from "@/types/roles";

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

function MemberHoverCardBody({ userId }: { userId: string }) {
  const { user, isLoading } = useUserById(userId);

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
  const memberSince = toDate(user.createdAt)?.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} size="lg" className="h-12 w-12 shrink-0" />
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
          </div>
        </div>
      </div>
      {memberSince && (
        <p className="text-xs text-muted">Member since {memberSince}</p>
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
