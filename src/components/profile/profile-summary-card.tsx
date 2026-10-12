import { Card, Chip, buttonVariants } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";
import { UserAvatar } from "@/components/avatar";
import { siteConfig } from "@/config/site";
import { toDate, type User } from "@/api/users";
import { BOARD_ROLE_META, formatBoardRoleLabel } from "@/types/roles";
import { formatPhone } from "@/utils/phone";

type ProfileSummaryCardProps = {
  user: User;
  isOwnProfile: boolean;
};

// Links styled as HeroUI buttons (mailto/tel/router links can't be <Button>).
const outlineLink = `${buttonVariants({ variant: "outline", fullWidth: true })} h-11`;
const primaryLink = `${buttonVariants({ variant: "primary", fullWidth: true })} h-11`;

function roleMeta(role: string | null | undefined) {
  return role && role in BOARD_ROLE_META
    ? BOARD_ROLE_META[role as keyof typeof BOARD_ROLE_META]
    : null;
}

/** Avatar, name, role chips, contact and (own profile) edit actions. */
export function ProfileSummaryCard({
  user,
  isOwnProfile,
}: ProfileSummaryCardProps) {
  const name =
    user.displayName ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    "Unknown Member";
  const meta = roleMeta(user.role);
  const memberSince = toDate(user.createdAt)?.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const tel = user.phone ? user.phone.replace(/[^\d+]/g, "") : "";

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-4 lg:flex-col lg:text-center">
        <UserAvatar
          user={user}
          size="lg"
          className="h-19 w-19 shrink-0 text-2xl lg:h-28 lg:w-28 lg:text-4xl"
        />
        <div className="flex min-w-0 flex-col gap-1.5 lg:items-center">
          <h1 className="text-2xl font-bold leading-tight">{name}</h1>
          <div className="flex flex-wrap gap-1.5 lg:justify-center">
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
          {memberSince && (
            <p className="text-sm text-muted">Member since {memberSince}</p>
          )}
        </div>
      </div>

      {(user.email || user.phone) && (
        <>
          {/* Phone: big tap targets. */}
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            {user.email && (
              <a
                href={`mailto:${user.email}`}
                className={outlineLink}
                aria-label={`Email ${name}`}
              >
                <Icon icon="lucide:mail" className="h-4 w-4" />
                Email
              </a>
            )}
            {user.phone && (
              <a
                href={`tel:${tel}`}
                className={outlineLink}
                aria-label={`Call ${name}`}
              >
                <Icon icon="lucide:phone" className="h-4 w-4" />
                Call
              </a>
            )}
          </div>
          {/* Desktop: show the actual details. */}
          <div className="hidden flex-col border-t border-border pt-2 lg:flex">
            {user.email && (
              <a
                href={`mailto:${user.email}`}
                className="flex min-h-11 items-center gap-2.5 text-sm text-foreground hover:underline"
              >
                <Icon icon="lucide:mail" className="h-4 w-4 shrink-0 text-muted" />
                <span className="truncate">{user.email}</span>
              </a>
            )}
            {user.phone && (
              <a
                href={`tel:${tel}`}
                className="flex min-h-11 items-center gap-2.5 text-sm text-foreground hover:underline"
              >
                <Icon icon="lucide:phone" className="h-4 w-4 shrink-0 text-muted" />
                {formatPhone(user.phone)}
              </a>
            )}
          </div>
        </>
      )}

      {isOwnProfile && (
        <div className="flex flex-col gap-2">
          <RouterLink
            to="/profile/edit"
            className={primaryLink}
          >
            <Icon icon="lucide:pencil" className="h-4 w-4" />
            Edit profile
          </RouterLink>
          <RouterLink
            to={siteConfig.pages.notificationSettings.link}
            className={`${outlineLink} hidden lg:inline-flex`}
          >
            <Icon icon="lucide:bell" className="h-4 w-4" />
            Notification settings
          </RouterLink>
        </div>
      )}
    </Card>
  );
}
