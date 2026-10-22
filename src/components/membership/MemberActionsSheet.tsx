import { Button, Drawer, buttonVariants } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Link as RouterLink } from "react-router-dom";

import type { User } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { memberName, membershipSummary } from "@/utils/memberDirectory";
import type { EmailIssue } from "@@/types";
import { EmailIssueNotice } from "./EmailIssueNotice";

const actionRow =
  "flex min-h-13 w-full items-center justify-start gap-3.5 rounded-none px-4 text-base";

interface MemberActionsSheetProps {
  /** The member whose actions are open; null closes the sheet. */
  member: User | null;
  year: number;
  emailIssue?: EmailIssue;
  onClose: () => void;
  onEdit: (member: User) => void;
  onDelete: (member: User) => void;
}

/** Admin, phone: per-member actions, with Delete set apart from the rest. */
export function MemberActionsSheet({
  member,
  year,
  emailIssue,
  onClose,
  onEdit,
  onDelete,
}: MemberActionsSheetProps) {
  const name = member ? memberName(member) : "";

  return (
    <Drawer.Backdrop
      isOpen={member !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Content placement="bottom">
        <Drawer.Dialog aria-label={`Actions for ${name}`}>
          <Drawer.Handle />
          {member && (
            <>
              <Drawer.Header>
                <div className="flex items-center gap-3">
                  <UserAvatar user={member} size="md" className="h-12 w-12 shrink-0" />
                  <div className="min-w-0">
                    <Drawer.Heading className="truncate">{name}</Drawer.Heading>
                    <p className="text-sm text-muted">
                      {membershipSummary(member, year)}
                    </p>
                  </div>
                </div>
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-3">
                {emailIssue && <EmailIssueNotice issue={emailIssue} />}
                <div className="overflow-hidden rounded-2xl bg-surface-secondary">
                  <RouterLink
                    to={`/profile/${member.id}`}
                    onClick={onClose}
                    className={`${buttonVariants({ variant: "ghost" })} ${actionRow}`}
                  >
                    <Icon icon="lucide:user" className="h-5 w-5 text-muted" />
                    View profile
                  </RouterLink>
                  <Button
                    variant="ghost"
                    className={`${actionRow} border-t border-separator`}
                    onPress={() => {
                      onClose();
                      onEdit(member);
                    }}
                  >
                    <Icon icon="lucide:pencil" className="h-5 w-5 text-muted" />
                    Edit member
                  </Button>
                </div>
                <div className="overflow-hidden rounded-2xl bg-surface-secondary">
                  <Button
                    variant="ghost"
                    className={`${actionRow} text-danger`}
                    onPress={() => {
                      onClose();
                      onDelete(member);
                    }}
                  >
                    <Icon icon="lucide:trash-2" className="h-5 w-5" />
                    Delete member…
                  </Button>
                </div>
              </Drawer.Body>
              <Drawer.Footer className="pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button variant="tertiary" className="h-11 w-full" onPress={onClose}>
                  Cancel
                </Button>
              </Drawer.Footer>
            </>
          )}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
