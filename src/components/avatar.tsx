import React from "react";
import { Avatar } from "@heroui/react";
import clsx from "clsx";

export interface UserAvatarProps {
  userId?: string; // used for generated image seed
  name?: string; // display name for initials fallback
  src?: string; // explicit image URL if available
  size?: "sm" | "md" | "lg";
  className?: string;
  squared?: boolean;
  alt?: string; // explicit alt text (falls back to name)
  // Allow passing through typical Avatar props from HeroUI (subset typed loosely to avoid tight coupling)
  isBordered?: boolean;
  color?: string;
  as?: any;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onPress?: (...args: any[]) => void; // if consumer still uses onPress pattern
  role?: string;
  tabIndex?: number;
}

/**
 * Central user avatar component ensuring consistent fallback behavior.
 * If no `src` provided, we seed a generic generated avatar using userId or name.
 */
export const UserAvatar = React.forwardRef<any, UserAvatarProps>(
  (
    {
      name,
      src,
      size = "sm",
      className,
      squared = false,
      alt,
      isBordered,
      color,
      as,
      onClick,
      onPress,
      role,
      tabIndex,
    },
    ref
  ) => {
    // Derive initials: first letter of first and last tokens; if only one token, use first two letters.
    const computeInitials = (full?: string) => {
      if (!full) return "?";
      const cleaned = full.trim().replace(/\s+/g, " ");
      if (!cleaned) return "?";
      const parts = cleaned.split(" ");
      if (parts.length === 1) {
        const solo = parts[0].replace(/[^A-Za-z]/g, "");
        if (solo.length >= 2) return (solo[0] + solo[1]).toUpperCase();
        if (solo.length === 1) return solo[0].toUpperCase();
        return "?";
      }
      // take first alpha char of first and last segment
      const first = parts[0].replace(/[^A-Za-z]/g, "");
      const last = parts[parts.length - 1].replace(/[^A-Za-z]/g, "");
      const fi = first ? first[0].toUpperCase() : "";
      const li = last ? last[0].toUpperCase() : "";
      const combo = (fi + li).trim();
      return combo || "?";
    };
    const initials = computeInitials(name);
    return (
      <Avatar
        ref={ref}
        showFallback
        radius={squared ? "sm" : "full"}
        name={initials}
        size={size}
        className={clsx(className)}
        src={src || undefined}
        alt={alt || name}
        isBordered={isBordered}
        color={color as any}
        as={as}
        onClick={
          (onClick as any) ?? (onPress ? (e: any) => onPress(e) : undefined)
        }
        role={role}
        tabIndex={tabIndex}
      />
    );
  }
);
UserAvatar.displayName = "UserAvatar";

// Backwards compatibility export (if any old import remains)
export const AvatarExample = () => <UserAvatar name="Chris" />;
