import React from "react";
import { Separator } from "@heroui/react";
import { TournamentStatus } from "@/types/tournament";
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
  registrations: Registration[];
  errors: Record<string, string>;
}

export const WinnersSection: React.FC<WinnersSectionProps> = ({
  isEditing,
  status,
  winnerGroups,
  setWinnerGroups,
  players,
  prizePool,
  completed,
  registrations,
  errors,
}) => {
  const show =
    isEditing ||
    status === TournamentStatus.Completed ||
    status === TournamentStatus.InProgress;

  if (!show) return null;

  return (
    <div className="pt-4">
      <Separator className="my-4" />
      <div className="grid grid-cols-1 gap-6">
        <div>
          <GroupedWinnersEditor
            groups={winnerGroups}
            onChange={setWinnerGroups}
            teamSize={players}
            prizePool={prizePool}
            isCompleted={completed}
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
          {errors.winners && (
            <p className="text-danger text-sm mt-2">{errors.winners}</p>
          )}
        </div>
      </div>
    </div>
  );
};
