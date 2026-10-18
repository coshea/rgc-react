import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MembershipSettingsForm } from "@/components/membership/membership-settings-form";

interface MembershipAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MembershipAdminModal({
  isOpen,
  onClose,
}: MembershipAdminModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider sticky top-0 bg-surface z-10">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Icon
              icon="lucide:settings"
              width={24}
              height={24}
              className="text-accent"
            />
            Membership Registration Settings
          </h2>
          <Button
            isIconOnly
            variant="tertiary"
            onPress={onClose}
            aria-label="Close modal"
          >
            <Icon icon="lucide:x" width={20} height={20} />
          </Button>
        </div>

        <MembershipSettingsForm layout="modal" onDone={onClose} />
      </div>
    </div>
  );
}
