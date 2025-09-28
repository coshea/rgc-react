import React from "react";
import { Icon } from "@iconify/react";
import { teeColorClasses, TeeName } from "@/utils/teeStyles";
import clsx from "clsx";

export interface TeeBadgeProps {
  tee: TeeName;
  size?: "xs" | "sm" | "md"; // controls padding & text size
  className?: string;
  withIcon?: boolean;
  variant?: "solid" | "soft"; // future expansion if needed
  titleCase?: boolean; // force display case
  compact?: boolean; // no background / minimal style, inherit text color accent
  ariaLabel?: string; // accessibility label override
  iconOnly?: boolean; // render only the icon (flag) with accessible label
}

/**
 * TeeBadge
 * Consistent visual treatment for a tournament tee designation.
 * Replaces scattered inline spans using teeColorClasses.
 */
export const TeeBadge: React.FC<TeeBadgeProps> = ({
  tee,
  size = "sm",
  className,
  withIcon = true,
  variant = "soft",
  titleCase = true,
  compact = false,
  ariaLabel,
  iconOnly = false,
}) => {
  const colors = teeColorClasses(tee);
  const sizing =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : size === "sm"
        ? "text-[11px] px-2 py-0.5 gap-1.5"
        : "text-xs px-2.5 py-1 gap-2";

  const label = titleCase ? tee || "Mixed" : tee || "Mixed";

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-md select-none",
        iconOnly ? (size === "xs" ? "p-0" : "p-0.5") : sizing,
        !compact && !iconOnly && colors,
        compact &&
          "bg-transparent text-foreground-500 dark:text-foreground-400 px-0 py-0 gap-1",
        variant === "solid" &&
          !compact &&
          !iconOnly &&
          "backdrop-brightness-[.85]",
        iconOnly && !compact && colors,
        className
      )}
      aria-label={ariaLabel || (iconOnly ? `${label} tee` : undefined)}
      role={iconOnly ? "img" : undefined}
    >
      {withIcon && (
        <Icon
          icon="lucide:flag"
          className={clsx(
            size === "xs"
              ? "w-3 h-3"
              : size === "sm"
                ? "w-3.5 h-3.5"
                : "w-4 h-4",
            "opacity-70"
          )}
        />
      )}
      {!iconOnly && label}
    </span>
  );
};

export default TeeBadge;
