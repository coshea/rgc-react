import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { disableAnalytics, enableAnalytics } from "@/config/firebase";
import { flushPageView } from "@/utils/analytics";

type ConsentStatus = "unknown" | "accepted" | "rejected";

type ConsentContextValue = {
  status: ConsentStatus;
  loading: boolean;
  accept: () => void;
  reject: () => void;
};

const ConsentContext = createContext<ConsentContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "rgc.cookieConsent";

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConsentStatus>("unknown");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "accepted" || saved === "rejected") {
        setStatus(saved);
      }
    } catch {
      // ignore storage failures
    } finally {
      setLoading(false);
    }
  }, []);

  // If accepted, enable analytics lazily, then send the page_view queued for
  // the page the user is on (it was held until analytics was ready).
  useEffect(() => {
    if (status === "accepted") {
      void enableAnalytics()
        .then(() => flushPageView())
        .catch(() => {
          // ignore analytics initialization errors
        });
    }
  }, [status]);

  const accept = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore storage failures
    }
    setStatus("accepted");
  }, []);

  const reject = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "rejected");
    } catch {
      // ignore storage failures
    }
    disableAnalytics();
    setStatus("rejected");
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({ status, loading, accept, reject }),
    [status, loading, accept, reject],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within a ConsentProvider");
  return ctx;
}
