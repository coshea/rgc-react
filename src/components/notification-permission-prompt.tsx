import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

interface NotificationPermissionPromptProps {
  onAllow: () => void;
  onDismiss: () => void;
}

/**
 * Custom pre-permission prompt shown before the browser's native dialog.
 * Explains the value of push notifications and lets users opt in (or skip)
 * before the browser's irreversible permission request fires.
 *
 * Rendered as a fixed bottom-right card so it doesn't interrupt page content.
 */
export function NotificationPermissionPrompt({
  onAllow,
  onDismiss,
}: NotificationPermissionPromptProps) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Enable push notifications"
      className="fixed bottom-6 right-5 z-[9999] w-80 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="bg-content1 border border-default-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Colour accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary to-secondary" />

        <div className="p-5">
          {/* Icon + heading */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:bell-ring" className="text-2xl text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground leading-tight">
                Stay in the loop
              </p>
              <p className="text-xs text-default-500 mt-0.5 leading-snug">
                Get notified about tournament registrations, results, and
                club&nbsp;announcements.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              color="primary"
              className="flex-1 font-medium"
              onPress={onAllow}
              startContent={
                <Icon icon="lucide:bell" className="text-sm shrink-0" />
              }
            >
              Enable notifications
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="default"
              className="shrink-0"
              onPress={onDismiss}
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
