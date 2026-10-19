import { Alert } from "@heroui/react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Shown while the phone has no connection, e.g. out on the course. Pages keep
 * working from the data Firestore saved on the device.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <Alert status="warning" className="mb-3" role="status">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>You&apos;re offline</Alert.Title>
        <Alert.Description>
          Showing tournaments and registrations saved on this device. Changes
          need a connection.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
