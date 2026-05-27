import React from "react";
import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { TournamentEditorForm } from "./tournament-editor/TournamentEditorForm";
import type { TournamentEditorFormState } from "./tournament-editor/types";

interface TournamentEditorProps {
  tournament?: Tournament | null;
  initialValues?: Partial<Tournament>;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
}

export const TournamentEditor: React.FC<TournamentEditorProps> = ({
  tournament,
  initialValues,
  onSave,
  onCancel,
}) => {
  const isEditing = !!tournament;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFormStateChange = (state: TournamentEditorFormState) => {
    setIsSubmitting(state.isSubmitting);
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <Card.Content className="p-6 overflow-y-auto flex-1 min-h-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">
            {isEditing ? "Edit Tournament" : "Create New Tournament"}
          </h2>
          <Button
            variant="ghost"
            isIconOnly
            onPress={onCancel}
            aria-label="Cancel"
          >
            <Icon icon="lucide:x" className="text-lg" />
          </Button>
        </div>
        <TournamentEditorForm
          tournament={tournament}
          initialValues={initialValues}
          onSave={onSave}
          onCancel={onCancel}
          onFormStateChange={handleFormStateChange}
        />
      </Card.Content>
      <Card.Footer className="flex justify-end gap-3 px-6 py-4 border-t border-divider bg-background shrink-0">
        <Button variant="tertiary" onPress={onCancel} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="tournament-editor-form"
          isLoading={isSubmitting}
        >
          {!isSubmitting && <Icon icon="lucide:save" />}
          {isEditing ? "Update Tournament" : "Create Tournament"}
        </Button>
      </Card.Footer>
    </Card>
  );
};

export default TournamentEditor;
