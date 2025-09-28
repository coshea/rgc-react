export type TeeName = "Blue" | "White" | "Gold" | "Red" | "Mixed" | undefined;

// variant: 'pill' (compact inline) | 'chip' (table chip)
export const teeColorClasses = (tee: TeeName): string => {
  const t = tee || "Mixed";
  const base =
    t === "Blue"
      ? "blue"
      : t === "White"
        ? "white"
        : t === "Gold"
          ? "yellow"
          : t === "Red"
            ? "red"
            : "teal";
  const map = (kind: string) => {
    switch (kind) {
      case "white":
        // White tee: subtle neutral background, lighten text in dark mode for contrast
        return "bg-default-100 text-default-700 dark:bg-default-200/40 dark:text-default-200";
      case "blue":
        // Increase background opacity slightly in dark mode for contrast
        return "bg-blue-500/15 text-blue-600 dark:bg-blue-500/25 dark:text-blue-200";
      case "yellow":
        // Yellow can wash out in dark mode; deepen text tone
        return "bg-yellow-500/15 text-yellow-600 dark:bg-yellow-500/25 dark:text-yellow-300";
      case "red":
        return "bg-red-500/15 text-red-600 dark:bg-red-500/25 dark:text-red-300";
      case "teal":
      default:
        return "bg-teal-500/15 text-teal-600 dark:bg-teal-500/25 dark:text-teal-300";
    }
  };
  return map(base);
};
