import React from "react";
import { Separator } from "@heroui/react";
import GroupedWinnersEditor from "@/components/grouped-winners-editor";
import type { WinnerGroup } from "@/types/winner";
import type { TournamentRegistration } from "./types";

interface WinnersSectionProps {
  winnerGroups: WinnerGroup[];
  onWinnerGroupsChange: (groups: WinnerGroup[]) => void;
  players: number;
  prizePool: number;
  isCompleted: boolean;
  registrations: TournamentRegistration[];
  error?: string;
}

export const WinnersSection: React.FC<WinnersSectionProps> = ({
  winnerGroups,
  onWinnerGroupsChange,
  players,
  prizePool,
  isCompleted,
  registrations,
  error,
}) => {
  return (
    <div className="pt-4">
      <Separator className="my-4" />
      <div className="grid grid-cols-1 gap-6">
        <div>
          <GroupedWinnersEditor
            groups={winnerGroups}
            onChange={onWinnerGroupsChange}
            teamSize={players}
            prizePool={prizePool}
            isCompleted={isCompleted}
            registrations={registrations.map((r) => ({
              id: r.id,
              ownerId: r.ownerId,
              team: (r.team ?? []).map((m) => ({
                id: m.id,
                displayName: m.displayName ?? m.id,
              })),
            }))}
          />
          {error && <p className="text-danger text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
};
