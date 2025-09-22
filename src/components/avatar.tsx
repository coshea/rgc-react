import React from "react";
import { Avatar } from "@heroui/react";
import clsx from "clsx";

export interface UserAvatarProps {
  userId?: string; // used for generated image seed
  name?: string; // display name for initials fallback
  src?: string; // explicit image URL if available
  user?: any; // full user object (expects displayName/profileURL/photoURL)
  size?: "sm" | "md" | "lg";
  className?: string;
  squared?: boolean;
  alt?: string; // explicit alt text (falls back to name)
  // Allow passing through typical Avatar props from HeroUI (subset typed loosely to avoid tight coupling)
  isBordered?: boolean;
  color?: string;
  as?: any;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onPress?: (...args: any[]) => void; // synthetic press handler (map to onClick)
  role?: string;
  tabIndex?: number;
}

/**
 * Central user avatar component ensuring consistent fallback behavior.
 * If no `src` provided, we seed a generic generated avatar using userId or name.
 */
export const UserAvatar = React.forwardRef<any, UserAvatarProps>(
  (props, ref) => {
    const {
      userId, // intentionally extracted so it is NOT forwarded to DOM / HeroUI Avatar
      name,
      src,
      user,
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
      ...rest
    } = props;

    // If we need the userId later for generated images we can hook here; suppress unused warning for now.
    void userId;

    // Resolve display name priority: explicit name prop > user.displayName > user.name > user.email
    const resolvedName =
      name ||
      (user && (user.displayName || (user as any).name || (user as any).email));

    // Resolve image source precedence: explicit src prop > user.profileURL > user.photoURL
    const resolvedSrc =
      src ||
      (user &&
        ((user as any).profileURL || (user as any).photoURL || undefined)) ||
      undefined;

    // Compose click handler: respect both provided onClick and onPress (mapping onPress -> onClick)
    const handleClick: React.MouseEventHandler<HTMLElement> | undefined =
      onClick || onPress
        ? (e) => {
            if (onClick) onClick(e);
            if (!e.defaultPrevented && onPress) onPress(e);
          }
        : undefined;

    // Provide keyboard accessibility if only onPress supplied
    const finalRole = role ?? (onPress ? "button" : undefined);
    const finalTabIndex =
      typeof tabIndex === "number" ? tabIndex : onPress ? 0 : undefined;

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
      const first = parts[0].replace(/[^A-Za-z]/g, "");
      const last = parts[parts.length - 1].replace(/[^A-Za-z]/g, "");
      const fi = first ? first[0].toUpperCase() : "";
      const li = last ? last[0].toUpperCase() : "";
      const combo = (fi + li).trim();
      return combo || "?";
    };
    const initials = computeInitials(resolvedName);

    return (
      <Avatar
        ref={ref}
        showFallback
        radius={squared ? "sm" : "full"}
        name={initials}
        size={size}
        className={clsx(className)}
        src={resolvedSrc}
        alt={alt || resolvedName}
        isBordered={isBordered}
        color={color as any}
        as={as}
        role={finalRole}
        tabIndex={finalTabIndex}
        onClick={handleClick}
        {...rest}
      />
    );
  }
);
UserAvatar.displayName = "UserAvatar";

// Backwards compatibility export (if any old import remains)
export const AvatarExample = () => <UserAvatar name="Chris" />;
