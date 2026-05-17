import { Button, Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";

import { addToast } from "@/providers/toast";
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
        .map((m) => m.email!.trim());
    case "paid-this-year":
      return members
        .filter((m) => m.lastPaidYear === currentYear && m.email?.trim())
        .map((m) => m.email!.trim());
    case "active-last-2-years":
      return members
        .filter((m) => activeSet.has(m.id) && m.email?.trim())
        .map((m) => m.email!.trim());
    case "all":
      return members.filter((m) => m.email?.trim()).map((m) => m.email!.trim());
  }
}

interface EmailMembersButtonProps {
  members: User[];
  activeSet: Set<string>;
  currentYear: number;
  size?: "sm" | "md" | "lg";
}

export function EmailMembersButton({
  members,
  activeSet,
  currentYear,
  size = "md",
}: EmailMembersButtonProps) {
  async function openMailto(scope: EmailScope) {
    const emails = getEmailAddresses(members, activeSet, scope, currentYear);
    if (!emails.length) {
      addToast({
        title: "No email addresses found",
        description: "There are no members with email addresses in this group.",
        color: "warning",
      });
      return;
    }

    const emailString = emails.join(",");
    const isLarge = emailString.length > 2000;

    if (isLarge && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(emailString);
        addToast({
          title: "Emails copied to clipboard",
          description: `${emails.length} email addresses copied. Paste into your email client manually.`,
          color: "success",
        });
        return;
      } catch (error) {
        console.error("Could not copy emails to clipboard:", error);
        addToast({
          title: "Clipboard copy failed",
          description:
            "Unable to copy long email list to clipboard. Trying mailto instead.",
          color: "danger",
        });
      }
    }

    window.location.href = `mailto:${emailString}`;
  }

  return (
    <Dropdown placement="bottom-end">
      <Dropdown.Trigger>
        <Button
          
          variant="tertiary"
          size={size}
          startContent={<Icon icon="lucide:mail" className="w-4 h-4" />}
          endContent={<Icon icon="lucide:chevron-down" className="w-4 h-4" />}
          className="font-medium"
        >
          Email Members
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Email recipient group">
          <Dropdown.Item
            id="full-members-this-year"
            onPress={() => openMailto("full-members-this-year")}
          >
            Full members this year ({currentYear})
          </Dropdown.Item>
          <Dropdown.Item
            id="paid-this-year"
            onPress={() => openMailto("paid-this-year")}
          >
            All paid this year ({currentYear})
          </Dropdown.Item>
          <Dropdown.Item
            id="active-last-2-years"
            onPress={() => openMailto("active-last-2-years")}
          >
            Active last 2 years
          </Dropdown.Item>
          <Dropdown.Item id="all" onPress={() => openMailto("all")}>
            All members
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
