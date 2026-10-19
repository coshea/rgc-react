import { useEffect, useState } from "react";

function prefersMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: no-preference)").matches === true
  );
}

/** Scales every number in `text` by `progress`, keeping thousands separators: "$1,105" → "$553" at 0.5. */
export function scaleNumbers(text: string, progress: number): string {
  return text.replace(/\d[\d,]*/g, (match) => {
    const value = Math.round(Number(match.replace(/,/g, "")) * progress);
    return match.includes(",") ? value.toLocaleString("en-US") : String(value);
  });
}

/** Eased 0→1 progress, or null when motion is reduced (render the final value). */
function useCountUpProgress(duration: number, delay: number): number | null {
  const [progress, setProgress] = useState<number | null>(() => (prefersMotion() ? 0 : null));

  useEffect(() => {
    if (!prefersMotion()) return;
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, delay]);

  return progress;
}

/**
 * Counts the numbers in `text` up from zero when the card appears. Screen
 * readers (and the card's aria-live region) only ever get the final text.
 */
export function CountUp({ text, delay = 0, duration = 900 }: { text: string; delay?: number; duration?: number }) {
  const progress = useCountUpProgress(duration, delay);
  if (progress === null || progress >= 1) return <>{text}</>;
  return (
    <>
      <span aria-hidden>{scaleNumbers(text, progress)}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
