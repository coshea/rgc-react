export interface PlaceMeta {
  icon: string;
  colorClass: string; // text color classes
  badgeBg?: string; // optional background if needed
}

/**
 * Returns icon + color classes for a placement (1..n)
 * Keeps styling consistent across tournament winners & earnings breakdowns.
 */
export function getPlaceMeta(place: number): PlaceMeta {
  if (place === 1) {
    return {
      icon: "lucide:crown",
      colorClass: "text-warning",
      badgeBg:
        "bg-amber-500/90 text-amber-950 dark:bg-amber-400 dark:text-amber-950",
    };
  }
  if (place === 2) {
    return {
      icon: "lucide:medal",
      colorClass: "text-foreground-400",
      badgeBg:
        "bg-slate-300/90 text-slate-800 dark:bg-slate-400 dark:text-slate-900",
    };
  }
  if (place === 3) {
    return {
      icon: "lucide:award",
      colorClass: "text-success",
      badgeBg: "bg-purple-500/90 text-purple-50",
    };
  }
  return {
    icon: "lucide:dot",
    colorClass: "text-foreground-400 opacity-70",
    badgeBg:
      "bg-default-100 dark:bg-default-50/20 text-default-600 dark:text-default-300",
  };
}

export function formatPlaceLabel(place: number) {
  return `Place ${place}`;
}
