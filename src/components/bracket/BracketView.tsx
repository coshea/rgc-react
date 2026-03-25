/**
 * BracketView – renders a SingleEliminationBracket using @g-loot/react-tournament-brackets.
 * Display-only component. Winner management is handled by the admin bracket-tab form.
 */

import {
  SingleEliminationBracket,
  Match,
  SVGViewer,
  type MatchType,
  type ParticipantType,
} from "@g-loot/react-tournament-brackets";

import type {
  TournamentBracket,
  BracketTeam,
  BracketMatch,
} from "@/types/bracket";
import { roundLabel } from "@/utils/bracketGenerator";

// ── Conversion: internal bracket → g-loot MatchType[] ───────────────────────

function toLibraryMatches(bracket: TournamentBracket): MatchType[] {
  const teamMap = new Map<string, BracketTeam>(
    bracket.teams.map((t) => [t.id, t]),
  );
  const numRounds = Math.log2(bracket.size);

  return bracket.matches.map((m): MatchType => {
    const team1 = m.team1Id ? (teamMap.get(m.team1Id) ?? null) : null;
    const team2 = m.team2Id ? (teamMap.get(m.team2Id) ?? null) : null;

    const participants: ParticipantType[] = [];

    // Top slot
    if (team1) {
      participants.push({
        id: team1.id,
        name: team1.name,
        isWinner: m.winnerId === team1.id,
        resultText:
          m.winnerId === team1.id ? "W" : m.winnerId != null ? null : null,
        status: m.winnerId != null ? ("PLAYED" as const) : null,
      });
    } else {
      const isBye = m.round === 1 && m.team2Id != null;
      participants.push({
        id: isBye ? `bye_top_${m.id}` : `tbd_top_${m.id}`,
        name: isBye ? "BYE" : "TBD",
        isWinner: false,
        resultText: null,
        status: isBye ? ("WALK_OVER" as const) : null,
      });
    }

    // Bottom slot
    if (team2) {
      participants.push({
        id: team2.id,
        name: team2.name,
        isWinner: m.winnerId === team2.id,
        resultText:
          m.winnerId === team2.id ? "W" : m.winnerId != null ? null : null,
        status: m.winnerId != null ? ("PLAYED" as const) : null,
      });
    } else {
      const isBye = m.round === 1 && m.team1Id != null;
      participants.push({
        id: isBye ? `bye_bottom_${m.id}` : `tbd_bottom_${m.id}`,
        name: isBye ? "BYE" : "TBD",
        isWinner: false,
        resultText: null,
        status: isBye ? ("WALK_OVER" as const) : null,
      });
    }

    const state =
      m.winnerId != null
        ? "DONE"
        : team1 != null && team2 != null
          ? "RUNNING"
          : "NO_PARTY";

    return {
      id: m.id,
      nextMatchId: m.nextMatchId,
      tournamentRoundText: roundLabel(m.round, numRounds),
      startTime: "",
      state,
      participants,
    };
  });
}

// ── Component ────────────────────────────────────────────────────────────────

interface BracketViewProps {
  bracket: TournamentBracket;
}

// Re-export the internal type for the admin match results form
export type { BracketMatch };

export function BracketView({ bracket }: BracketViewProps) {
  const libMatches = toLibraryMatches(bracket);

  // Compute SVG viewer dimensions based on bracket size
  const numRounds = Math.log2(bracket.size);
  const viewerWidth = Math.max(600, numRounds * 260 + 60);
  const viewerHeight = Math.max(300, (bracket.size / 2) * 90 + 60);

  return (
    <div className="w-full overflow-x-auto">
      <SingleEliminationBracket
        matches={libMatches}
        matchComponent={Match}
        svgWrapper={({ bracketWidth, bracketHeight, startAt, children }) => (
          <SVGViewer
            width={viewerWidth}
            height={viewerHeight}
            bracketWidth={bracketWidth}
            bracketHeight={bracketHeight}
            startAt={startAt}
            scaleFactor={1}
          >
            {children}
          </SVGViewer>
        )}
      />
    </div>
  );
}
