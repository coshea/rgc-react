/**
 * BracketView – renders a single-elimination bracket as a left-to-right tree
 * using absolute positioning + SVG connector lines.
 *
 * Display-only component. Winner management is handled by the admin bracket-tab form.
 */

import type {
  TournamentBracket,
  BracketMatch,
  BracketTeam,
} from "@/types/bracket";
import { roundLabel } from "@/utils/bracketGenerator";
import {
  BracketMatchCard,
  calcSlotHeight,
  calcMatchHeight,
} from "./BracketMatchCard";

// Re-export for consumers that previously imported BracketMatch via this module
export type { BracketMatch };

// ── Layout constants ──────────────────────────────────────────────────────────

const MATCH_WIDTH = 240;
const V_GAP = 16;
const H_GAP = 56;
const ROUND_LABEL_HEIGHT = 36;

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Computes the pixel dimensions of a bracket for a given TournamentBracket.
 * Useful for pre-computing scale factors (e.g. for print layout) without
 * mounting the component.
 */
export function calcBracketDimensions(bracket: TournamentBracket): {
  width: number;
  height: number;
} {
  const { teams, size } = bracket;
  const numRounds = Math.log2(size);
  const n1 = size / 2;
  const maxMembers = teams.reduce((acc, t) => {
    const count =
      t.memberNames && t.memberNames.length > 0 ? t.memberNames.length : 1;
    return Math.max(acc, count);
  }, 1);
  const cardH = calcMatchHeight(maxMembers);
  const slotUnit = cardH + V_GAP;
  const totalWidth = numRounds * MATCH_WIDTH + (numRounds - 1) * H_GAP;
  const bracketHeight = n1 * slotUnit - V_GAP;
  const totalHeight = ROUND_LABEL_HEIGHT + bracketHeight;
  return { width: totalWidth, height: totalHeight };
}

function matchTopY(
  round: number,
  pos: number,
  slotUnit: number,
  cardH: number,
): number {
  const span = Math.pow(2, round - 1);
  const topSlot = pos * span;
  return topSlot * slotUnit + (span * slotUnit - cardH) / 2;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BracketViewProps {
  bracket: TournamentBracket;
  /** Called when the user clicks a team slot in the bracket. */
  onTeamPress?: (team: BracketTeam) => void;
  /** uid → photo URL for resolving member profile pictures */
  userPhotoMap?: Map<string, string>;
}

export function BracketView({
  bracket,
  onTeamPress,
  userPhotoMap,
}: BracketViewProps) {
  const { teams, matches, size } = bracket;
  const numRounds = Math.log2(size);
  const n1 = size / 2;

  const teamMap = new Map<string, BracketTeam>(teams.map((t) => [t.id, t]));

  const maxMembers = teams.reduce((acc, t) => {
    const count =
      t.memberNames && t.memberNames.length > 0 ? t.memberNames.length : 1;
    return Math.max(acc, count);
  }, 1);
  const slotH = calcSlotHeight(maxMembers);
  const cardH = calcMatchHeight(maxMembers);
  const SLOT_UNIT = cardH + V_GAP;

  const matchesByRound = new Map<number, typeof matches>();
  for (let r = 1; r <= numRounds; r++) {
    matchesByRound.set(
      r,
      matches
        .filter((m) => m.round === r)
        .sort((a, b) => a.position - b.position),
    );
  }

  const totalWidth = numRounds * MATCH_WIDTH + (numRounds - 1) * H_GAP;
  const bracketHeight = n1 * SLOT_UNIT - V_GAP;
  const totalHeight = ROUND_LABEL_HEIGHT + bracketHeight;

  type Line = { x1: number; y1: number; x2: number; y2: number; key: string };
  const connectorLines: Line[] = [];

  for (let r = 1; r < numRounds; r++) {
    const roundMatches = matchesByRound.get(r) ?? [];
    const roundLeftX = (r - 1) * (MATCH_WIDTH + H_GAP);
    const rightEdge = roundLeftX + MATCH_WIDTH;
    const midX = roundLeftX + MATCH_WIDTH + H_GAP / 2;
    const nextRoundX = r * (MATCH_WIDTH + H_GAP);

    for (let i = 0; i < roundMatches.length; i += 2) {
      const topMatch = roundMatches[i];
      const bottomMatch = roundMatches[i + 1];
      if (!topMatch || !bottomMatch) continue;

      const topY =
        ROUND_LABEL_HEIGHT +
        matchTopY(r, topMatch.position, SLOT_UNIT, cardH) +
        cardH / 2;
      const bottomY =
        ROUND_LABEL_HEIGHT +
        matchTopY(r, bottomMatch.position, SLOT_UNIT, cardH) +
        cardH / 2;
      const midY = (topY + bottomY) / 2;

      connectorLines.push(
        { x1: rightEdge, y1: topY, x2: midX, y2: topY, key: `ht-${r}-${i}` },
        { x1: midX, y1: topY, x2: midX, y2: midY, key: `vt-${r}-${i}` },
        {
          x1: rightEdge,
          y1: bottomY,
          x2: midX,
          y2: bottomY,
          key: `hb-${r}-${i}`,
        },
        { x1: midX, y1: bottomY, x2: midX, y2: midY, key: `vb-${r}-${i}` },
        { x1: midX, y1: midY, x2: nextRoundX, y2: midY, key: `out-${r}-${i}` },
      );
    }
  }

  // Setting an explicit height on the scroll container prevents overflow-y: auto
  // (implicitly set when overflow-x: auto is used) from creating a vertical scrollbar.
  return (
    <div
      className="w-full overflow-x-auto touch-pan-x touch-pan-y"
      style={{ height: totalHeight + 16 }}
    >
      <div
        style={{ position: "relative", width: totalWidth, height: totalHeight }}
      >
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: totalWidth,
            height: totalHeight,
            pointerEvents: "none",
          }}
          aria-hidden="true"
          className="text-muted"
        >
          {connectorLines.map(({ x1, y1, x2, y2, key }) => (
            <line
              key={key}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {Array.from({ length: numRounds }, (_, i) => {
          const r = i + 1;
          return (
            <div
              key={`label-${r}`}
              style={{
                position: "absolute",
                left: i * (MATCH_WIDTH + H_GAP),
                top: 0,
                width: MATCH_WIDTH,
                height: ROUND_LABEL_HEIGHT,
              }}
              className="flex items-center justify-center"
            >
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                {roundLabel(r, numRounds)}
              </span>
            </div>
          );
        })}

        {Array.from(matchesByRound.entries()).flatMap(([round, roundMatches]) =>
          roundMatches.map((match) => {
            const topY = matchTopY(round, match.position, SLOT_UNIT, cardH);
            return (
              <div
                key={match.id}
                style={{
                  position: "absolute",
                  left: (round - 1) * (MATCH_WIDTH + H_GAP),
                  top: ROUND_LABEL_HEIGHT + topY,
                }}
              >
                <BracketMatchCard
                  match={match}
                  teamMap={teamMap}
                  width={MATCH_WIDTH}
                  slotHeight={slotH}
                  onTeamPress={onTeamPress}
                  userPhotoMap={userPhotoMap}
                />
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
