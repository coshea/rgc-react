import { useEffect, useState } from "react";

import { useUserRegistrations } from "@/hooks/useUserTournaments";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { useAuth } from "@/providers/AuthProvider";

const WARMUP_DELAY_MS = 3000;

/**
 * Reads this year's tournaments and the member's upcoming registrations once
 * the page has settled, so Firestore saves them on the device. At the course,
 * with no reception, the tournament list and "My registrations" then load from
 * that saved copy. Uses the same query keys as the pages, so nothing is read
 * twice. Renders nothing.
 */
export function OfflineWarmup() {
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), WARMUP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const uid = ready && !loading ? user?.uid : undefined;
  useYearlyTournaments({ year: new Date().getFullYear(), enabled: !!uid });
  useUserRegistrations(uid);

  return null;
}
