import { Button, Modal } from "@heroui/react";
import { ProfileForm } from "@/components/profile-form";

type EditProfileModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditProfileModal({
  isOpen,
  onOpenChange,
}: EditProfileModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container
        size="lg"
        scroll="inside"
        className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] py-2 sm:py-4"
      >
        <Modal.Dialog className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]">
          <>
            <Modal.Header className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Edit Profile</h2>
              <p className="text-sm text-muted">
                Update your profile information and settings
              </p>
            </Modal.Header>
            <Modal.Body className="overflow-hidden">
              <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] px-6 pt-2 sm:pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <ProfileForm
                  hideActions
                  formId="profile-edit-form"
                  onSaved={() => onOpenChange(false)}
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form="profile-edit-form">
                Save
              </Button>
            </Modal.Footer>
          </>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
