import { Button, Card, Chip, buttonVariants } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";
import * as Sentry from "@sentry/react";

import type { User } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { addToast } from "@/providers/toast";
import { formatBoardRoleLabel } from "@/types/roles";
import { formatPhone } from "@/utils/phone";
import { memberName, telHref } from "@/utils/memberDirectory";
import { MEMBERSHIP_TYPES, type EmailIssue } from "@@/types";
import { EmailIssueNotice } from "./EmailIssueNotice";

// Links styled as HeroUI buttons (mailto/tel/router links can't be <Button>).
const primaryLink = `${buttonVariants({ variant: "primary" })} h-11`;
const outlineLink = `${buttonVariants({ variant: "outline" })} h-11`;
const ghostLink = `${buttonVariants({ variant: "ghost" })} h-11`;

interface MemberContactPanelProps {
  member: User | null;
  isAdmin: boolean;
  emailIssue?: EmailIssue;
  onEdit: (member: User) => void;
  onDelete: (member: User) => void;
}

async function copyToClipboard(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    addToast({ title: `${what} copied`, description: text, color: "success" });
  } catch (error) {
    Sentry.captureException(error);
    addToast({
      title: "Couldn't copy",
      description: "Select the text and copy it instead.",
      color: "danger",
    });
  }
}

function CopyButton({ text, what }: { text: string; what: string }) {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      className="h-9 w-9 text-muted"
      aria-label={`Copy ${what.toLowerCase()}`}
      onPress={() => void copyToClipboard(text, what)}
    >
      <Icon icon="lucide:copy" className="h-4 w-4" />
    </Button>
  );
}

/** Desktop: contact details for the member selected in the directory list. */
export function MemberContactPanel({
  member,
  isAdmin,
  emailIssue,
  onEdit,
  onDelete,
}: MemberContactPanelProps) {
  if (!member) {
    return (
      <Card className="flex min-h-64 items-center justify-center p-8 text-center text-muted">
        Select a member to see their contact details.
      </Card>
    );
  }

  const name = memberName(member);
  const tel = telHref(member.phone);

  return (
    <Card className="flex flex-col gap-6 p-8" aria-label={name}>
      <div className="flex items-center gap-5">
        <UserAvatar
          user={member}
          size="lg"
          className="h-22 w-22 shrink-0 text-3xl"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="truncate text-2xl leading-tight">{name}</h2>
          {member.boardMember && (
            <p className="flex items-center gap-1.5 text-muted">
              <Icon
                icon="lucide:flag"
                className="h-4 w-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              {formatBoardRoleLabel(member.role)}, Board of Governors
            </p>
          )}
          {/* Same chip and wording as the full profile page. */}
          {member.membershipType === MEMBERSHIP_TYPES.HANDICAP && (
            <Chip size="sm" variant="tertiary" className="self-start">
              Handicap Only
            </Chip>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {tel && (
          <a href={tel} className={primaryLink}>
            <Icon icon="lucide:phone" className="h-4 w-4" />
            Call
          </a>
        )}
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className={tel ? outlineLink : primaryLink}
          >
            <Icon icon="lucide:mail" className="h-4 w-4" />
            Email
          </a>
        )}
        <RouterLink to={`/profile/${member.id}`} className={ghostLink}>
          View profile
        </RouterLink>
      </div>

      {(member.email || member.phone) && (
        <dl className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-4 border-t border-separator pt-3">
          {member.email && (
            <>
              <dt className="py-2.5 text-muted">Email</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <a
                  href={`mailto:${member.email}`}
                  className="truncate text-accent hover:underline"
                >
                  {member.email}
                </a>
                <CopyButton text={member.email} what="Email address" />
              </dd>
            </>
          )}
          {member.phone && (
            <>
              <dt className="py-2.5 text-muted">Phone</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <a href={tel} className="text-accent hover:underline">
                  {formatPhone(member.phone)}
                </a>
                <CopyButton
                  text={formatPhone(member.phone)}
                  what="Phone number"
                />
              </dd>
            </>
          )}
        </dl>
      )}

      {isAdmin && (
        <section
          aria-labelledby="member-panel-membership"
          className="flex flex-col gap-4 rounded-2xl bg-surface-secondary p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="member-panel-membership" className="text-lg">
              Membership
            </h3>
            <span className="text-sm text-muted">
              Only admins see this section
            </span>
          </div>
          {emailIssue && <EmailIssueNotice issue={emailIssue} />}
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-muted">Type</dt>
              <dd className="mt-1">
                {member.membershipType === MEMBERSHIP_TYPES.FULL
                  ? "Full"
                  : member.membershipType === MEMBERSHIP_TYPES.HANDICAP
                    ? "Handicap only"
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Last paid</dt>
              <dd className="mt-1">{member.lastPaidYear ?? "Never"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">GHIN</dt>
              <dd className="mt-1 truncate">{member.ghinNumber || "—"}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="tertiary"
              className="h-11"
              onPress={() => onEdit(member)}
            >
              <Icon icon="lucide:pencil" className="h-4 w-4" />
              Edit member
            </Button>
            <Button
              variant="ghost"
              className="h-11 text-danger"
              onPress={() => onDelete(member)}
            >
              <Icon icon="lucide:trash-2" className="h-4 w-4" />
              Delete member…
            </Button>
          </div>
        </section>
      )}
    </Card>
  );
}
