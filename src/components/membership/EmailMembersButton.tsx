import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import type { User } from "@/api/users";

export type EmailScope =
  | "full-members-this-year"
  | "paid-this-year"
  | "active-last-2-years"
  | "all";

export function getEmailAddresses(
  members: User[],
  activeSet: Set<string>,
  scope: EmailScope,
  currentYear: number,
): string[] {
  switch (scope) {
    case "full-members-this-year":
      return members
        .filter(
          (m) =>
            m.lastPaidYear === currentYear &&
            m.membershipType === "full" &&
            m.email?.trim(),
        )
        .map((m) => m.email!);
    case "paid-this-year":
      return members
        .filter((m) => m.lastPaidYear === currentYear && m.email?.trim())
        .map((m) => m.email!);
    case "active-last-2-years":
      return members
        .filter((m) => activeSet.has(m.id) && m.email?.trim())
        .map((m) => m.email!);
    case "all":
      return members.filter((m) => m.email?.trim()).map((m) => m.email!);
  }
}

interface EmailMembersButtonProps {
  members: User[];
  activeSet: Set<string>;
  currentYear: number;
}

export function EmailMembersButton({
  members,
  activeSet,
  currentYear,
}: EmailMembersButtonProps) {
  function openMailto(scope: EmailScope) {
    const emails = getEmailAddresses(members, activeSet, scope, currentYear);
    if (!emails.length) return;
    window.location.href = `mailto:${emails.join(",")}`;
  }

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          color="secondary"
          variant="flat"
          startContent={<Icon icon="lucide:mail" className="w-4 h-4" />}
          endContent={<Icon icon="lucide:chevron-down" className="w-4 h-4" />}
          className="font-medium"
        >
          Email Members
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Email recipient group"
        onAction={(key) => openMailto(key as EmailScope)}
      >
        <DropdownItem key="full-members-this-year">
          Full members this year ({currentYear})
        </DropdownItem>
        <DropdownItem key="paid-this-year">
          All paid this year ({currentYear})
        </DropdownItem>
        <DropdownItem key="active-last-2-years">
          Active last 2 years
        </DropdownItem>
        <DropdownItem key="all">All members</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
