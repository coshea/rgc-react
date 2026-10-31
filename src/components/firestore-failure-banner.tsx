import { useEffect, useState } from "react";
import { Alert, Button } from "@heroui/react";

import { isFirestoreCacheFailure } from "@/utils/firebaseErrors";

/**
 * Shown when Firestore's on-device cache breaks (an iOS Safari bug). Nothing
 * loads or saves after that until the page reloads, so offer a reload rather
 * than doing it automatically and losing what the member was typing.
 */
export function FirestoreFailureBanner() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isFirestoreCacheFailure(event.error)) setFailed(true);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isFirestoreCacheFailure(event.reason)) setFailed(true);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!failed) return null;

  return (
    <Alert status="danger" className="mb-3" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Something went wrong loading club data</Alert.Title>
        <Alert.Description>
          Reload the page to keep going.
        </Alert.Description>
      </Alert.Content>
      <Button size="sm" onPress={() => window.location.reload()}>
        Reload
      </Button>
    </Alert>
  );
}
