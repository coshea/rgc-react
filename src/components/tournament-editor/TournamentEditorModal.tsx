import React from "react";
import { Modal, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { TournamentEditorForm } from "./TournamentEditorForm";
import type { TournamentEditorFormState } from "./types";

interface TournamentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament?: Tournament | null;
  initialValues?: Partial<Tournament>;
  onSave: (tournament: Tournament) => void;
}

export const TournamentEditorModal: React.FC<TournamentEditorModalProps> = ({
  isOpen,
  onClose,
  tournament,
  initialValues,
  onSave,
}) => {
  const isEditing = !!tournament;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFormStateChange = (state: TournamentEditorFormState) => {
    setIsSubmitting(state.isSubmitting);
  };

  const handleSave = (saved: Tournament) => {
    onSave(saved);
    onClose();
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className="md:max-h-[90vh] md:max-w-5xl">
          <Modal.Header>
            <span>
              {isEditing ? "Edit Tournament" : "Create New Tournament"}
            </span>
            <button
              className="ml-auto rounded p-1 hover:bg-default/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="Close"
              onClick={onClose}
            >
              <Icon icon="lucide:x" className="text-lg" />
            </button>
          </Modal.Header>
          <Modal.Body>
            <TournamentEditorForm
              tournament={tournament}
              initialValues={initialValues}
              onSave={handleSave}
              onCancel={onClose}
              onFormStateChange={handleFormStateChange}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="tertiary"
              onPress={onClose}
              isDisabled={isSubmitting}
            >
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
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

export default TournamentEditorModal;
