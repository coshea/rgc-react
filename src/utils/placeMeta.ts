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
      icon: "lucide:trophy",
      colorClass: "text-warning",
      badgeBg:
        "bg-amber-500/90 text-amber-950 dark:bg-amber-400 dark:text-amber-950",
    };
  }
  if (place === 2) {
    return {
      icon: "lucide:medal",
      colorClass: "text-default-400",
      badgeBg:
        "bg-slate-300/90 text-slate-800 dark:bg-slate-400 dark:text-slate-900",
    };
  }
  if (place === 3) {
    // 3rd place: award icon with bronze-like accent
    return {
      icon: "lucide:award",
      colorClass: "text-amber-700",
      badgeBg:
        "bg-amber-200/90 text-amber-900 dark:bg-amber-300 dark:text-amber-950",
    };
  }
  // 4th and beyond: award icon with a muted neutral style (distinct from 3rd's bronze)
  return {
    icon: "lucide:award",
    colorClass: "text-blue-400",
    badgeBg: "bg-blue-100 dark:bg-blue-50/20 text-blue-600 dark:text-blue-300",
  };
}

export function formatPlaceLabel(place: number) {
  return `Place ${place}`;
}
