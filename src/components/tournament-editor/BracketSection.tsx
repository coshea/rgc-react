import React from "react";
import { Button } from "@heroui/react";
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
  publishingBracket: boolean;
  setPublishingBracket: (v: boolean) => void;
  tournament: Tournament;
  registrations: Registration[];
  allUsers: User[];
}

export const BracketSection: React.FC<BracketSectionProps> = ({
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
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {tournament.bracketPublished
            ? "Members can see this bracket."
            : "Only admins can see this bracket until you publish it."}
        </p>
        <Button
          size="sm"
          variant={tournament.bracketPublished ? "primary" : "tertiary"}
          onPress={handleTogglePublish}
          isDisabled={publishingBracket}
          className="min-h-11 md:min-h-0"
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
      <div className="overflow-x-auto">
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
    </div>
  );
};
