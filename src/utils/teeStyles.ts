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
        return "bg-default-100 text-default-700 dark:text-default-300";
      case "blue":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-300";
      case "yellow":
        return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
      case "red":
        return "bg-red-500/15 text-red-600 dark:text-red-400";
      case "teal":
      default:
        return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
    }
  };
  return map(base);
};
