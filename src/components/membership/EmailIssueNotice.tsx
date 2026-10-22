import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useClearEmailIssue } from "@/hooks/useEmailIssues";
import {
  EMAIL_ISSUE_STATUS,
  type EmailIssue,
  type EmailIssueStatus,
} from "@@/types";

const MESSAGES: Record<EmailIssueStatus, string> = {
  [EMAIL_ISSUE_STATUS.BOUNCED]: "Emails to this address bounced",
  [EMAIL_ISSUE_STATUS.COMPLAINED]: "This member marked a club email as spam",
  [EMAIL_ISSUE_STATUS.SUPPRESSED]: "Our email provider is blocking this address",
};

function formatOccurredAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/** Admin warning for a member's email delivery problem, with a Clear action. */
export function EmailIssueNotice({ issue }: { issue: EmailIssue }) {
  const clear = useClearEmailIssue();
  const when = formatOccurredAt(issue.occurredAt);

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-3 text-sm">
      <Icon
        icon="lucide:triangle-alert"
        className="mt-0.5 h-4 w-4 shrink-0 text-warning"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 basis-56">
        {MESSAGES[issue.status]}
        {when ? ` on ${when}` : ""}. Member emails skip it until you clear the
        warning.
      </p>
      <Button
        size="sm"
        variant="tertiary"
        className="min-h-11 sm:min-h-8"
        isDisabled={clear.isPending}
        onPress={() => clear.mutate(issue.email)}
      >
        Clear warning
      </Button>
    </div>
  );
}
