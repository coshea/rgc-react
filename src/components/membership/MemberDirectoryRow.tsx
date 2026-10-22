import { Button, buttonVariants } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";
import clsx from "clsx";

import type { User } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { boardRoleIcon, formatBoardRoleLabel } from "@/types/roles";
import {
  memberName,
  membershipSummary,
  membershipTag,
  telHref,
} from "@/utils/memberDirectory";

// Links styled as HeroUI buttons (mailto/tel links can't be <Button>).
const contactLink = `${buttonVariants({ variant: "secondary", isIconOnly: true })} h-11 w-11 shrink-0 rounded-full`;

export interface MemberDirectoryRowProps {
  member: User;
  isAdmin: boolean;
  /** Desktop: the row selects the member into the contact panel. */
  isDesktop: boolean;
  isSelected: boolean;
  hasEmailIssue: boolean;
  year: number;
  /** Admin, phone: opens the member actions sheet. */
  onMore?: (member: User) => void;
}

export function memberRowId(id: string) {
  return `member-row-${id}`;
}

export function MemberDirectoryRow({
  member,
  isAdmin,
  isDesktop,
  isSelected,
  hasEmailIssue,
  year,
  onMore,
}: MemberDirectoryRowProps) {
  const name = memberName(member);
  const tel = telHref(member.phone);
  const tag = isAdmin ? membershipTag(member, year) : null;

  const identity = (
    <>
      <span className="relative shrink-0">
        <UserAvatar user={member} size="sm" className="h-10 w-10 lg:h-8 lg:w-8" />
        {isDesktop && hasEmailIssue && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warning"
            aria-hidden="true"
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base lg:text-[15px]">{name}</span>
        {member.boardMember && (
          <span className="flex items-center gap-1 truncate text-sm text-muted">
            <Icon
              icon={boardRoleIcon(member.role)}
              className="h-3.5 w-3.5 shrink-0 text-accent"
              aria-hidden="true"
            />
            {formatBoardRoleLabel(member.role)}
          </span>
        )}
        {isAdmin && !isDesktop && (
          <span className="truncate text-sm text-muted">
            {membershipSummary(member, year)}
          </span>
        )}
      </span>
      {isDesktop && hasEmailIssue && (
        <span className="sr-only">, emails bouncing</span>
      )}
      {tag && isDesktop && (
        <span className="ml-auto shrink-0 text-sm text-muted">{tag}</span>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <li>
        <RouterLink
          id={memberRowId(member.id)}
          to={{ search: `?member=${encodeURIComponent(member.id)}` }}
          replace
          aria-current={isSelected ? "true" : undefined}
          className={clsx(
            "flex min-h-13 items-center gap-3 rounded-xl px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-focus",
            isSelected ? "bg-accent-soft" : "hover:bg-surface-secondary",
          )}
        >
          {identity}
        </RouterLink>
      </li>
    );
  }

  return (
    <li className="flex min-h-16 items-center gap-1.5 py-2 pl-3 pr-2">
      <RouterLink
        to={`/profile/${member.id}`}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {identity}
      </RouterLink>
      {tel ? (
        <a href={tel} className={contactLink} aria-label={`Call ${name}`}>
          <Icon icon="lucide:phone" className="h-[18px] w-[18px]" />
        </a>
      ) : (
        <span className="w-11 shrink-0" aria-hidden="true" />
      )}
      {member.email ? (
        <a
          href={`mailto:${member.email}`}
          className={clsx(contactLink, "relative")}
          aria-label={
            hasEmailIssue
              ? `Email ${name} (emails are bouncing)`
              : `Email ${name}`
          }
        >
          <Icon icon="lucide:mail" className="h-[18px] w-[18px]" />
          {hasEmailIssue && (
            <span
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warning"
              aria-hidden="true"
            />
          )}
        </a>
      ) : (
        <span className="w-11 shrink-0" aria-hidden="true" />
      )}
      {isAdmin && onMore && (
        <Button
          isIconOnly
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label={`More actions for ${name}`}
          onPress={() => onMore(member)}
        >
          <Icon icon="lucide:ellipsis" className="h-5 w-5" />
        </Button>
      )}
    </li>
  );
}
