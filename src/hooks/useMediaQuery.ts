import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const getMatches = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;

    const mql = window.matchMedia(query);

    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Ensure we’re synced even if query changes.
    setMatches(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    // Safari < 14
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
