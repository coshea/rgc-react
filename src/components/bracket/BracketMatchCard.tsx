/**
 * BracketMatchCard – displays a single bracket match with two team slots.
 * Each team member is shown on their own row (avatar + name), matching the
 * RegistrationsList style. Card height is uniform across the bracket and
 * driven by the slotHeight prop passed in from the layout engine.
 */

import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import type { BracketMatch, BracketTeam } from "@/types/bracket";

// ── Height helpers (consumed by layout engine) ────────────────────────────────

/** Height of a single member row in px (avatar sm=24px + comfortable padding). */
export const MEMBER_ROW_H = 32;
/** Top + bottom padding inside each team slot in px (py-2 = 8px × 2). */
const SLOT_PADDING = 16;

/**
 * Calculates the pixel height for one team slot given number of members.
 * Minimum 1 so placeholder/BYE/TBD slots have the same height as real teams.
 */
export function calcSlotHeight(memberCount: number): number {
  return Math.max(1, memberCount) * MEMBER_ROW_H + SLOT_PADDING;
}

/** Total card height for two equally-sized slots plus a 1px divider. */
export function calcMatchHeight(membersPerSlot: number): number {
  return calcSlotHeight(membersPerSlot) * 2 + 1;
}

// ── Team slot ─────────────────────────────────────────────────────────────────

interface SlotProps {
  team: BracketTeam | null;
  isBye: boolean;
  isWinner: boolean;
  isLoser: boolean;
  slotHeight: number;
}

function TeamSlot({ team, isBye, isWinner, isLoser, slotHeight }: SlotProps) {
  const base =
    "relative px-3 py-2 transition-colors flex flex-col justify-center";

  if (isBye) {
    return (
      <div className={`${base} opacity-40`} style={{ height: slotHeight }}>
        <span className="text-xs italic text-default-400">BYE</span>
      </div>
    );
  }

  if (!team) {
    return (
      <div className={`${base} opacity-40`} style={{ height: slotHeight }}>
        <div className="flex items-center gap-1.5">
          <Icon icon="lucide:clock" className="w-3.5 h-3.5 text-default-400" />
          <span className="text-xs text-default-400 italic">TBD</span>
        </div>
      </div>
    );
  }

  const names =
    team.memberNames && team.memberNames.length > 0
      ? team.memberNames
      : [team.name];

  return (
    <div
      className={[
        base,
        "gap-1",
        isWinner ? "bg-success-50 dark:bg-success-900/20" : "",
        isLoser ? "opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: slotHeight }}
    >
      {names.map((name, i) => (
        <div key={`${name}-${i}`} className="flex items-center gap-2 min-w-0">
          <UserAvatar name={name} size="sm" className="shrink-0" />
          <span
            className={[
              "text-xs min-w-0 truncate",
              isWinner
                ? "font-semibold text-success-700 dark:text-success-400"
                : "text-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
            title={name}
          >
            {name}
          </span>
          {isWinner && i === 0 && (
            <Icon
              icon="lucide:check"
              className="w-3.5 h-3.5 text-success-600 shrink-0 ml-auto"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface BracketMatchCardProps {
  match: BracketMatch;
  teamMap: Map<string, BracketTeam>;
  width: number;
  /** Pixel height for each team slot – passed from the layout engine. */
  slotHeight: number;
}

export function BracketMatchCard({
  match,
  teamMap,
  width,
  slotHeight,
}: BracketMatchCardProps) {
  const team1 = match.team1Id ? (teamMap.get(match.team1Id) ?? null) : null;
  const team2 = match.team2Id ? (teamMap.get(match.team2Id) ?? null) : null;

  // A "bye" slot is a null team in round 1 when the other slot has a team
  const isBye1 = match.round === 1 && team2 !== null && team1 === null;
  const isBye2 = match.round === 1 && team1 !== null && team2 === null;

  const isWinner1 = match.winnerId !== null && match.winnerId === match.team1Id;
  const isWinner2 = match.winnerId !== null && match.winnerId === match.team2Id;
  const isLoser1 = match.winnerId !== null && !isWinner1 && team1 !== null;
  const isLoser2 = match.winnerId !== null && !isWinner2 && team2 !== null;

  return (
    <div
      style={{ width }}
      className="border border-default-200 rounded-xl bg-content1 overflow-hidden shadow-sm"
    >
      <TeamSlot
        team={team1}
        isBye={isBye1}
        isWinner={isWinner1}
        isLoser={isLoser1}
        slotHeight={slotHeight}
      />
      <div className="border-t border-default-200" />
      <TeamSlot
        team={team2}
        isBye={isBye2}
        isWinner={isWinner2}
        isLoser={isLoser2}
        slotHeight={slotHeight}
      />
    </div>
  );
}
