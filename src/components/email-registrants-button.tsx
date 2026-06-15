import { Button, Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";

import { copyOrMailtoEmails } from "@/utils/email";
import type { User } from "@/api/users";
import type { TournamentBracket } from "@/types/bracket";

type TournamentEmailScope =
  | "in-tournament"
  | "all"
  | "bracket-alive"
  | "bracket-not-played";

interface RegistrantEntry {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string }>;
}

interface EmailRegistrantsButtonProps {
  registrations: RegistrantEntry[];
  usersMap: Map<string, User>;
  /** Teams at index >= maxTeams are considered waitlisted. Omit if no cap. */
  maxTeams?: number;
  /** When provided, enables the "Still alive in bracket" email option. */
  bracket?: TournamentBracket | null;
  size?: "sm" | "md" | "lg";
  /** Extra classes forwarded to the trigger Button. */
  className?: string;
}

/**
 * Returns registration entries whose teams are still alive in the bracket.
 * Alive = has not lost any match (i.e. no match exists where their team is
 * the loser — meaning winnerId is set to the *other* team).
 */
function getAliveRegistrations(
  registrations: RegistrantEntry[],
  bracket: TournamentBracket,
): RegistrantEntry[] {
  const eliminatedIds = new Set<string>();
  for (const match of bracket.matches) {
    if (!match.winnerId) continue;
    if (match.team1Id && match.team1Id !== match.winnerId) {
      eliminatedIds.add(match.team1Id);
    }
    if (match.team2Id && match.team2Id !== match.winnerId) {
      eliminatedIds.add(match.team2Id);
    }
  }
  // A registration is alive if it appears in the bracket and hasn't been eliminated.
  const bracketTeamIds = new Set(bracket.teams.map((t) => t.id));
  return registrations.filter(
    (reg) => bracketTeamIds.has(reg.id) && !eliminatedIds.has(reg.id),
  );
}

/**
 * Returns registration entries whose teams have not yet played any completed match.
 * Not played = in the bracket but not a participant in any match where winnerId is set.
 */
function getNotPlayedRegistrations(
  registrations: RegistrantEntry[],
  bracket: TournamentBracket,
): RegistrantEntry[] {
  const playedIds = new Set<string>();
  for (const match of bracket.matches) {
    if (!match.winnerId) continue;
    if (match.team1Id) playedIds.add(match.team1Id);
    if (match.team2Id) playedIds.add(match.team2Id);
  }
  const bracketTeamIds = new Set(bracket.teams.map((t) => t.id));
  return registrations.filter(
    (reg) => bracketTeamIds.has(reg.id) && !playedIds.has(reg.id),
  );
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
  bracket,
  size = "sm",
  className,
}: EmailRegistrantsButtonProps) {
  const inTournament =
    maxTeams !== undefined ? registrations.slice(0, maxTeams) : registrations;

  const aliveRegistrations = bracket
    ? getAliveRegistrations(inTournament, bracket)
    : null;

  const notPlayedRegistrations = bracket
    ? getNotPlayedRegistrations(inTournament, bracket)
    : null;

  async function openMailto(scope: TournamentEmailScope) {
    let subset: RegistrantEntry[];
    if (scope === "bracket-alive" && aliveRegistrations) {
      subset = aliveRegistrations;
    } else if (scope === "bracket-not-played" && notPlayedRegistrations) {
      subset = notPlayedRegistrations;
    } else if (scope === "in-tournament") {
      subset = inTournament;
    } else {
      subset = registrations;
    }
    const emails = collectEmails(subset, usersMap);
    await copyOrMailtoEmails(emails);
  }

  if (!registrations.length) return null;

  const inCount = inTournament.length;
  const allCount = registrations.length;
  const hasWaitlist = maxTeams !== undefined && allCount > maxTeams;
  const aliveCount = aliveRegistrations?.length ?? 0;
  const notPlayedCount = notPlayedRegistrations?.length ?? 0;

  return (
    <Dropdown>
      <Button
        variant="primary"
        size={size}
        className={`font-medium whitespace-nowrap${className ? ` ${className}` : ""}`}
      >
        <Icon icon="lucide:mail" className="w-4 h-4" />
        Email Registrants
        <Icon icon="lucide:chevron-down" className="w-4 h-4" />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Email registrant group">
          {aliveRegistrations !== null && (
            <Dropdown.Item
              id="bracket-alive"
              textValue={`Still alive in bracket (${aliveCount})`}
              onPress={() => openMailto("bracket-alive")}
            >
              Still alive in bracket ({aliveCount})
            </Dropdown.Item>
          )}
          {notPlayedRegistrations !== null && (
            <Dropdown.Item
              id="bracket-not-played"
              textValue={`Haven't played yet (${notPlayedCount})`}
              onPress={() => openMailto("bracket-not-played")}
            >
              Haven't played yet ({notPlayedCount})
            </Dropdown.Item>
          )}
          <Dropdown.Item
            id="in-tournament"
            textValue={`In tournament (${inCount})`}
            onPress={() => openMailto("in-tournament")}
          >
            In tournament ({inCount})
          </Dropdown.Item>
          <Dropdown.Item
            id="all"
            textValue={
              hasWaitlist
                ? `All incl. waitlist (${allCount})`
                : `All (${allCount})`
            }
            onPress={() => openMailto("all")}
          >
            All
            {hasWaitlist ? ` incl. waitlist (${allCount})` : ` (${allCount})`}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
