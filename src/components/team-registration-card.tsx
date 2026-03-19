import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { TeeBadge } from "@/components/tee-badge";
import type { User } from "@/api/users";

export interface TeamMember {
  id: string;
  displayName?: string;
  goldTee?: boolean;
}

export interface TeamRegistrationCardProps {
  /** 1-based index label ("Team 1", "Team 2", …) */
  teamNumber: number;
  /** Members to display, leader first */
  displayTeam: TeamMember[];
  leaderId: string | undefined;
  /** Whether this team is on the waitlist */
  isWaitlisted: boolean;
  /** Number of open spots the captain is advertising */
  openSpots: number;
  /** True when openSpotsOptIn is true and openSpots > 0 */
  showOpenSpots: boolean;
  /** Formatted date string for registration timestamp */
  dateStr: string;
  /** Max players per team, used to show Leader chip */
  maxPlayers: number;
  /** Map of uid → User for avatar lookups */
  usersMap: Map<string, User>;
  /** Called when the card is pressed (open-spots teams only) */
  onPress?: () => void;
}

export function TeamRegistrationCard({
  teamNumber,
  displayTeam,
  leaderId,
  isWaitlisted,
  openSpots,
  showOpenSpots,
  dateStr,
  maxPlayers,
  usersMap,
  onPress,
}: TeamRegistrationCardProps) {
  const cardClassName = `rounded-md border transition-colors ${
    showOpenSpots
      ? "border-warning/60 bg-warning/5 hover:bg-warning/10"
      : "border-default-200 bg-content2/60 hover:bg-content2"
  }${
    showOpenSpots
      ? " cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-warning/60"
      : ""
  }`;

  return (
    <Card
      className={cardClassName}
      aria-label={
        showOpenSpots ? `Open spot details for Team ${teamNumber}` : undefined
      }
      isPressable={showOpenSpots}
      onPress={showOpenSpots ? onPress : undefined}
    >
      <CardBody className="p-2 sm:p-3 flex flex-col h-full gap-1.5 sm:gap-2 relative group">
        {/* Header: team number + date + waitlist chip */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-foreground-400 font-medium shrink-0">
              Team {teamNumber}
            </p>
            {dateStr && (
              <span className="text-[11px] text-foreground-400 truncate">
                · {dateStr}
              </span>
            )}
          </div>
          {isWaitlisted && (
            <Chip
              size="sm"
              variant="flat"
              color="warning"
              className="h-5 px-2 text-[10px] shrink-0"
            >
              Waitlist
            </Chip>
          )}
        </div>

        {/* Member rows: avatar | name | Leader chip */}
        <ul className="space-y-0.5">
          {displayTeam.map((m, i) => {
            const memberUser = usersMap.get(m.id);
            const label = (m.displayName || m.id || "").toString();
            const isLeader = !!leaderId && m.id === leaderId;
            return (
              <li key={m.id || i} className="flex items-center gap-2 min-w-0">
                <UserAvatar
                  size="sm"
                  user={memberUser}
                  name={memberUser ? undefined : label}
                  className={
                    isLeader
                      ? "shrink-0 border border-default-200 ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "shrink-0 border border-default-200"
                  }
                  alt={label}
                />
                <span
                  className={`text-[13px] sm:text-sm font-medium truncate min-w-0 ${
                    isLeader ? "text-primary" : ""
                  }`}
                >
                  {m.displayName || m.id}
                </span>
                {isLeader && maxPlayers > 1 && (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="primary"
                    className="h-5 px-2 text-[10px] shrink-0"
                  >
                    Leader
                  </Chip>
                )}
                {m.goldTee && (
                  <TeeBadge
                    tee="Gold"
                    size="xs"
                    className="shrink-0"
                    ariaLabel="Gold tees"
                  />
                )}
              </li>
            );
          })}
          {showOpenSpots && (
            <li className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 shrink-0 rounded-full border border-dashed border-warning/60 flex items-center justify-center text-[10px] font-medium text-warning bg-warning/10"
                aria-label={`${openSpots} open team spot${openSpots === 1 ? "" : "s"}`}
                title={`${openSpots} open spot${openSpots === 1 ? "" : "s"}`}
              >
                +{openSpots}
              </div>
              <span className="text-[11px] font-medium text-warning flex items-center gap-1">
                <Icon
                  icon="lucide:alert-circle"
                  className="w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
                {openSpots === 1 ? "1 Spot Open" : `${openSpots} Spots Open`}
              </span>
            </li>
          )}
        </ul>
      </CardBody>
    </Card>
  );
}
