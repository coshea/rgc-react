import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { copyOrMailtoEmails } from "@/utils/email";
import type { User } from "@/api/users";

type TournamentEmailScope = "in-tournament" | "all";

interface RegistrantEntry {
  ownerId?: string;
  team?: Array<{ id: string }>;
}

interface EmailRegistrantsButtonProps {
  registrations: RegistrantEntry[];
  usersMap: Map<string, User>;
  /** Teams at index >= maxTeams are considered waitlisted. Omit if no cap. */
  maxTeams?: number;
  size?: "sm" | "md" | "lg";
  /** Extra classes forwarded to the trigger Button. */
  className?: string;
}

function collectEmails(
  registrations: RegistrantEntry[],
  usersMap: Map<string, User>,
): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const reg of registrations) {
    const ids = new Set<string>();
    if (reg.ownerId) ids.add(reg.ownerId);
    for (const m of reg.team ?? []) ids.add(m.id);
    for (const id of ids) {
      const email = usersMap.get(id)?.email?.trim();
      if (email && !seen.has(email)) {
        seen.add(email);
        emails.push(email);
      }
    }
  }
  return emails;
}

export function EmailRegistrantsButton({
  registrations,
  usersMap,
  maxTeams,
  size = "sm",
  className,
}: EmailRegistrantsButtonProps) {
  const inTournament =
    maxTeams !== undefined ? registrations.slice(0, maxTeams) : registrations;

  async function openMailto(scope: TournamentEmailScope) {
    const subset = scope === "in-tournament" ? inTournament : registrations;
    const emails = collectEmails(subset, usersMap);
    await copyOrMailtoEmails(emails);
  }

  if (!registrations.length) return null;

  const inCount = inTournament.length;
  const allCount = registrations.length;
  const hasWaitlist = maxTeams !== undefined && allCount > maxTeams;

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          color="secondary"
          variant="flat"
          size={size}
          startContent={<Icon icon="lucide:mail" className="w-4 h-4" />}
          endContent={<Icon icon="lucide:chevron-down" className="w-4 h-4" />}
          className={`font-medium whitespace-nowrap${className ? ` ${className}` : ""}`}
        >
          Email Registrants
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Email registrant group"
        onAction={(key) => openMailto(key as TournamentEmailScope)}
      >
        <DropdownItem
          key="in-tournament"
          textValue={`In tournament (${inCount})`}
        >
          In tournament ({inCount})
        </DropdownItem>
        <DropdownItem
          key="all"
          textValue={
            hasWaitlist
              ? `All incl. waitlist (${allCount})`
              : `All (${allCount})`
          }
        >
          All{hasWaitlist ? ` incl. waitlist (${allCount})` : ` (${allCount})`}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
