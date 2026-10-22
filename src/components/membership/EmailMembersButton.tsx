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

/** Recipient groups, in menu order. */
export function emailScopeOptions(
  currentYear: number,
): { id: EmailScope; label: string }[] {
  return [
    {
      id: "full-members-this-year",
      label: `Full members this year (${currentYear})`,
    },
    { id: "paid-this-year", label: `All paid this year (${currentYear})` },
    { id: "active-last-2-years", label: "Active last 2 years" },
    { id: "all", label: "All members" },
  ];
}

/**
 * Opens a mailto with the group's addresses. Long lists are copied to the
 * clipboard instead, since mail clients truncate very long mailto URLs.
 */
export async function emailMembers(
  members: User[],
  activeSet: Set<string>,
  scope: EmailScope,
  currentYear: number,
) {
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
  const clipboard =
    typeof navigator === "undefined" ? undefined : navigator.clipboard;

  if (isLarge && clipboard) {
    try {
      await clipboard.writeText(emailString);
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

interface EmailMembersButtonProps {
  members: User[];
  activeSet: Set<string>;
  currentYear: number;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "tertiary";
}

export function EmailMembersButton({
  members,
  activeSet,
  currentYear,
  size = "md",
  variant = "primary",
}: EmailMembersButtonProps) {
  return (
    <Dropdown>
      <Button variant={variant} size={size} className="font-medium">
        <Icon icon="lucide:mail" className="w-4 h-4" />
        Email members
        <Icon icon="lucide:chevron-down" className="w-4 h-4" />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Email recipient group">
          {emailScopeOptions(currentYear).map((o) => (
            <Dropdown.Item
              key={o.id}
              id={o.id}
              textValue={o.label}
              onPress={() =>
                void emailMembers(members, activeSet, o.id, currentYear)
              }
            >
              {o.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
