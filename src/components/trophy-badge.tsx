import { Icon } from "@iconify/react";
import clsx from "clsx";

const TONES: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300",
  2: "bg-slate-200 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300",
  3: "bg-orange-100 text-orange-800 dark:bg-orange-400/20 dark:text-orange-300",
};

interface Props {
  /** 1, 2 or 3; anything else renders nothing. */
  rank: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Gold, silver or bronze trophy for the top three. Decorative: the rank is
 * always shown as text beside it.
 */
export function TrophyBadge({ rank, size = "sm", className }: Props) {
  const tone = TONES[rank];
  if (!tone) return null;
  return (
    <span
      aria-hidden="true"
      data-testid={`trophy-${rank}`}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "w-9 h-9" : "w-6 h-6",
        tone,
        className,
      )}
    >
      <Icon
        icon="lucide:trophy"
        className={size === "md" ? "w-5 h-5" : "w-3.5 h-3.5"}
      />
    </span>
  );
}
