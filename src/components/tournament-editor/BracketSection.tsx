import React from "react";
import { Button, Separator } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { User } from "@/api/users";
import {
  BracketEditor,
  RegistrationDoc,
} from "@/components/bracket/BracketEditor";
import { setBracketPublished } from "@/api/tournaments";
import { addToast } from "@/providers/toast";
import type { Registration } from "@/components/registrations-list";

interface BracketSectionProps {
  bracketOpen: boolean;
  setBracketOpen: React.Dispatch<React.SetStateAction<boolean>>;
  publishingBracket: boolean;
  setPublishingBracket: (v: boolean) => void;
  tournament: Tournament;
  registrations: Registration[];
  allUsers: User[];
}

export const BracketSection: React.FC<BracketSectionProps> = ({
  bracketOpen,
  setBracketOpen,
  publishingBracket,
  setPublishingBracket,
  tournament,
  registrations,
  allUsers,
}) => {
  if (!tournament.firestoreId) return null;

  const handleTogglePublish = async () => {
    if (!tournament.firestoreId) return;
    setPublishingBracket(true);
    try {
      const next = !tournament.bracketPublished;
      await setBracketPublished(tournament.firestoreId, next);
      addToast({
        title: next ? "Bracket published" : "Bracket unpublished",
        description: next
          ? "The bracket is now visible to all members."
          : "The bracket is now hidden from members.",
        color: next ? "success" : "default",
      });
    } catch {
      addToast({
        title: "Update failed",
        description: "Could not update bracket visibility.",
        color: "danger",
      });
    } finally {
      setPublishingBracket(false);
    }
  };

  return (
    <div className="pt-6">
      <Separator className="my-4" />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setBracketOpen((o) => !o)}
          aria-expanded={bracketOpen}
          className="flex-1 flex items-center justify-between py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <h3 className="text-lg font-medium">Tournament Bracket</h3>
          <Icon
            icon="lucide:chevron-down"
            className={`w-5 h-5 text-muted transition-transform duration-200 ${bracketOpen ? "rotate-180" : ""}`}
          />
        </button>
        <Button
          size="sm"
          variant={tournament.bracketPublished ? "primary" : "tertiary"}
          onPress={handleTogglePublish}
          isDisabled={publishingBracket}
        >
          {!publishingBracket && (
            <Icon
              icon={
                tournament.bracketPublished ? "lucide:eye" : "lucide:eye-off"
              }
              className="w-4 h-4"
            />
          )}
          {tournament.bracketPublished ? "Published" : "Publish"}
        </Button>
      </div>
      {bracketOpen && (
        <div className="pt-2">
          <BracketEditor
            tournamentId={tournament.firestoreId}
            registrations={
              registrations.filter(
                (
                  r,
                ): r is Registration & {
                  team: NonNullable<Registration["team"]>;
                  ownerId: string;
                } => r.team != null && r.ownerId != null,
              ) as unknown as RegistrationDoc[]
            }
            allUsers={allUsers}
            bracketPublished={tournament.bracketPublished}
          />
        </div>
      )}
    </div>
  );
};
