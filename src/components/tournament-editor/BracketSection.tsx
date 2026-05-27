import React from "react";
import { Separator, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { BracketEditor } from "@/components/bracket/BracketEditor";
import type { User } from "@/api/users";
import type { TournamentRegistration } from "./types";

interface BracketSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  tournamentId: string;
  bracketPublished: boolean;
  registrations: TournamentRegistration[];
  allUsers: User[];
  publishingBracket: boolean;
  onPublishBracket: () => Promise<void>;
}

export const BracketSection: React.FC<BracketSectionProps> = ({
  isOpen,
  onToggle,
  tournamentId,
  bracketPublished,
  registrations,
  allUsers,
  publishingBracket,
  onPublishBracket,
}) => {
  return (
    <div className="pt-6">
      <Separator className="my-4" />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 flex items-center justify-between py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <h3 className="text-lg font-medium">Tournament Bracket</h3>
          <Icon
            icon="lucide:chevron-down"
            className={`w-5 h-5 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        <Button
          size="sm"
          variant={bracketPublished ? "primary" : "tertiary"}
          onPress={onPublishBracket}
          isDisabled={publishingBracket}
        >
          {!publishingBracket && (
            <Icon
              icon={bracketPublished ? "lucide:eye" : "lucide:eye-off"}
              className="w-4 h-4"
            />
          )}
          {bracketPublished ? "Published" : "Publish"}
        </Button>
      </div>
      {isOpen && (
        <div className="pt-2">
          <BracketEditor
            tournamentId={tournamentId}
            registrations={registrations}
            allUsers={allUsers}
            bracketPublished={bracketPublished}
          />
        </div>
      )}
    </div>
  );
};
