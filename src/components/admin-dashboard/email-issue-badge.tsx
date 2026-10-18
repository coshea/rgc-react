import { Button, Chip, Popover } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useClearEmailIssue } from "@/hooks/useEmailIssues";
import {
  EMAIL_ISSUE_STATUS,
  type EmailIssue,
  type EmailIssueStatus,
} from "@@/types";

const LABELS: Record<EmailIssueStatus, string> = {
  [EMAIL_ISSUE_STATUS.BOUNCED]: "Email bounced",
  [EMAIL_ISSUE_STATUS.COMPLAINED]: "Marked as spam",
  [EMAIL_ISSUE_STATUS.SUPPRESSED]: "Email suppressed",
};

function formatOccurredAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

/**
 * Shows a Resend delivery problem for a member's address (recorded by the
 * `resend_webhook` function). Automated emails skip the address until an
 * admin clears it or the member changes their email.
 */
export function EmailIssueBadge({ issue }: { issue: EmailIssue }) {
  const clear = useClearEmailIssue();
  const when = formatOccurredAt(issue.occurredAt);

  return (
    <div className="flex items-center gap-2">
      {/* Popover, not Tooltip: tooltips don't open on tap, so phones need it. */}
      <Popover>
        <Button
          size="sm"
          variant="ghost"
          className="h-auto min-h-11 px-1 sm:min-h-8"
          aria-label={`${LABELS[issue.status]}: show details`}
        >
          <Chip size="sm" color="danger" variant="soft">
            <Icon icon="lucide:mail-x" className="w-3 h-3" />
            {LABELS[issue.status]}
          </Chip>
        </Button>
        <Popover.Content placement="top" className="max-w-xs">
          <Popover.Dialog aria-label={LABELS[issue.status]}>
            <p className="text-sm">
              {issue.reason ?? LABELS[issue.status]}
              {when ? ` (${when})` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              Automated emails skip this address until it&apos;s cleared or the
              member updates their email.
            </p>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <Button
        size="sm"
        variant="tertiary"
        className="min-h-11 sm:min-h-8"
        isDisabled={clear.isPending}
        onPress={() => clear.mutate(issue.email)}
        aria-label={`Clear email issue for ${issue.email}`}
      >
        Clear
      </Button>
    </div>
  );
}
