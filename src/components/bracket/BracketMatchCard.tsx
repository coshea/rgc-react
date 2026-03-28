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
  isChampion: boolean;
  isRunnerUp: boolean;
  slotHeight: number;
  onPress?: () => void;
  seed?: number;
  /** uid → photo URL, for resolving member profile pictures */
  userPhotoMap?: Map<string, string>;
}

function TeamSlot({
  team,
  isBye,
  isWinner,
  isLoser,
  isChampion,
  isRunnerUp,
  slotHeight,
  onPress,
  seed,
  userPhotoMap,
}: SlotProps) {
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

  // Build rows from memberIds so that index i always maps to the correct
  // memberId for avatar resolution. Fall back to [team.name] only when there
  // are no memberIds at all.
  const rows: Array<{ id: string | undefined; label: string }> =
    team.memberIds.length > 0
      ? team.memberIds.map((id, i) => ({
          id,
          label: team.memberNames?.[i] ?? (i === 0 ? team.name : id),
        }))
      : [{ id: undefined, label: team.name }];

  const content = (
    <>
      {rows.map(({ id, label }, i) => (
        <div
          key={`${id ?? label}-${i}`}
          className={`flex items-center gap-2 min-w-0${onPress ? " pr-6" : ""}`}
        >
          {i === 0 && seed !== undefined ? (
            <span
              className="shrink-0 text-[10px] font-bold w-2 text-center text-default-400"
              aria-label={`Seed ${seed}`}
            >
              {seed}
            </span>
          ) : (
            <span className="shrink-0 w-2" aria-hidden="true" />
          )}
          <UserAvatar
            name={label}
            size="sm"
            className="shrink-0"
            src={id ? (userPhotoMap?.get(id) ?? undefined) : undefined}
          />
          <span
            className={[
              "text-xs min-w-0 truncate",
              isChampion
                ? "font-semibold text-warning-700 dark:text-warning-400"
                : isWinner
                  ? "font-semibold text-success-700 dark:text-success-400"
                  : "text-foreground",
            ]
              .filter(Boolean)
              .join(" ")}
            title={label}
          >
            {label}
          </span>
          {i === 0 && isChampion && (
            <Icon
              icon="lucide:trophy"
              className="w-3.5 h-3.5 text-warning-500 shrink-0 ml-auto"
            />
          )}
          {i === 0 && isRunnerUp && (
            <Icon
              icon="lucide:medal"
              className="w-3.5 h-3.5 text-default-400 shrink-0 ml-auto"
            />
          )}
          {i === 0 && !isChampion && !isRunnerUp && isWinner && (
            <Icon
              icon="lucide:check"
              className="w-3.5 h-3.5 text-success-600 shrink-0 ml-auto"
            />
          )}
        </div>
      ))}
      {onPress && (
        <Icon
          icon="lucide:info"
          className="absolute top-2 right-2 w-3 h-3 text-default-300 group-hover:text-default-500 transition-colors"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (onPress) {
    return (
      <button
        type="button"
        className={[
          base,
          "group gap-1 w-full text-left cursor-pointer hover:bg-default-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          isChampion
            ? "bg-warning-50 dark:bg-warning-900/20 hover:bg-warning-100 dark:hover:bg-warning-900/30"
            : isWinner
              ? "bg-success-50 dark:bg-success-900/20 hover:bg-success-100 dark:hover:bg-success-900/30"
              : "",
          isLoser && !isRunnerUp ? "opacity-40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ height: slotHeight }}
        onClick={onPress}
        aria-label={`View team info: ${rows.map((r) => r.label).join(", ")}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={[
        base,
        "gap-1",
        isChampion
          ? "bg-warning-50 dark:bg-warning-900/20"
          : isWinner
            ? "bg-success-50 dark:bg-success-900/20"
            : "",
        isLoser && !isRunnerUp ? "opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ height: slotHeight }}
    >
      {content}
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
  /** Called when the user presses a team slot; receives the BracketTeam. */
  onTeamPress?: (team: BracketTeam) => void;
  /** uid → photo URL for resolving member profile pictures */
  userPhotoMap?: Map<string, string>;
}

export function BracketMatchCard({
  match,
  teamMap,
  width,
  slotHeight,
  onTeamPress,
  userPhotoMap,
}: BracketMatchCardProps) {
  const team1 = match.team1Id ? (teamMap.get(match.team1Id) ?? null) : null;
  const team2 = match.team2Id ? (teamMap.get(match.team2Id) ?? null) : null;

  const isBye1 = match.round === 1 && team2 !== null && team1 === null;
  const isBye2 = match.round === 1 && team1 !== null && team2 === null;

  const isWinner1 = match.winnerId !== null && match.winnerId === match.team1Id;
  const isWinner2 = match.winnerId !== null && match.winnerId === match.team2Id;
  const isLoser1 = match.winnerId !== null && !isWinner1 && team1 !== null;
  const isLoser2 = match.winnerId !== null && !isWinner2 && team2 !== null;
  const isFinal = match.nextMatchId === null;
  const isChampion1 = isFinal && isWinner1;
  const isChampion2 = isFinal && isWinner2;
  const isRunnerUp1 = isFinal && isLoser1;
  const isRunnerUp2 = isFinal && isLoser2;

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
        isChampion={isChampion1}
        isRunnerUp={isRunnerUp1}
        slotHeight={slotHeight}
        onPress={team1 && onTeamPress ? () => onTeamPress(team1) : undefined}
        seed={team1?.seed}
        userPhotoMap={userPhotoMap}
      />
      <div className="border-t border-default-200" />
      <TeamSlot
        team={team2}
        isBye={isBye2}
        isWinner={isWinner2}
        isLoser={isLoser2}
        isChampion={isChampion2}
        isRunnerUp={isRunnerUp2}
        slotHeight={slotHeight}
        onPress={team2 && onTeamPress ? () => onTeamPress(team2) : undefined}
        seed={team2?.seed}
        userPhotoMap={userPhotoMap}
      />
    </div>
  );
}
