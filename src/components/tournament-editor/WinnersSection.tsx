import React from "react";
import { BracketRoundPayout, TournamentStatus } from "@/types/tournament";
import type { WinnerGroup } from "@/types/winner";
import GroupedWinnersEditor from "@/components/grouped-winners-editor";
import type { Registration } from "@/components/registrations-list";

interface WinnersSectionProps {
  isEditing: boolean;
  status: TournamentStatus;
  winnerGroups: WinnerGroup[];
  setWinnerGroups: (v: WinnerGroup[]) => void;
  players: number;
  prizePool: number;
  completed: boolean;
  bracketRoundPayouts: BracketRoundPayout[];
  setBracketRoundPayouts: (v: BracketRoundPayout[]) => void;
  onRecalculateBracketPayouts?: () => void;
  recalculatingBracketPayouts?: boolean;
  registrations: Registration[];
  automatedBracketWinnerGroupsCount?: number;
  errors: Record<string, string>;
}

/** Whether the Results section has anything to show for this tournament. */
export function shouldShowWinnersSection({
  isEditing,
  status,
  bracketRoundPayoutsCount,
}: {
  isEditing: boolean;
  status: TournamentStatus;
  bracketRoundPayoutsCount: number;
}): boolean {
  return (
    isEditing ||
    status === TournamentStatus.Completed ||
    status === TournamentStatus.InProgress ||
    bracketRoundPayoutsCount > 0
  );
}

export const WinnersSection: React.FC<WinnersSectionProps> = ({
  isEditing,
  status,
  winnerGroups,
  setWinnerGroups,
  players,
  prizePool,
  completed,
  bracketRoundPayouts,
  setBracketRoundPayouts,
  onRecalculateBracketPayouts,
  recalculatingBracketPayouts = false,
  registrations,
  automatedBracketWinnerGroupsCount = 0,
  errors,
}) => {
  if (
    !shouldShowWinnersSection({
      isEditing,
      status,
      bracketRoundPayoutsCount: bracketRoundPayouts.length,
    })
  ) {
    return null;
  }

  return (
    <div className="min-w-0">
      <div>
        <GroupedWinnersEditor
          groups={winnerGroups}
          onChange={setWinnerGroups}
          teamSize={players}
          prizePool={prizePool}
          isCompleted={completed}
          bracketRoundPayouts={bracketRoundPayouts}
          setBracketRoundPayouts={setBracketRoundPayouts}
          onRecalculateBracketPayouts={onRecalculateBracketPayouts}
          recalculatingBracketPayouts={recalculatingBracketPayouts}
          automatedBracketWinnerGroupsCount={automatedBracketWinnerGroupsCount}
          errors={errors}
          registrations={registrations
            .filter((r) => r.team != null)
            .map((r) => ({
              id: r.id,
              team: (r.team ?? []).map((m) => ({
                id: m.id,
                displayName: m.displayName ?? "",
              })),
              ownerId: r.ownerId,
            }))}
        />
        {completed && errors.winners && (
          <p className="text-danger text-sm mt-2">{errors.winners}</p>
        )}
      </div>
    </div>
  );
};
