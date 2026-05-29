import React from "react";
import { Avatar } from "@heroui/react";
import clsx from "clsx";
// We accept a subset of the app's User fields without re-exporting the full type here
type AvatarUserShape = Partial<{
  id: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  profileURL: string | null;
}>;

export interface UserAvatarProps {
  userId?: string; // used for generated image seed
  name?: string; // display name for initials fallback
  src?: string; // explicit image URL if available
  user?: AvatarUserShape; // full user object (expects displayName/profileURL/photoURL)
  size?: "sm" | "md" | "lg";
  className?: string;
  squared?: boolean;
  alt?: string; // explicit alt text (falls back to name)
  // Allow passing through typical Avatar props from HeroUI (subset typed loosely to avoid tight coupling)
  isBordered?: boolean;
  color?: React.ComponentProps<typeof Avatar>["color"];
  as?: any;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onPress?: (...args: any[]) => void; // synthetic press handler (map to onClick)
  role?: string;
  tabIndex?: number;
}

/** Generate up to 2 initials from a display name or email. */
function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    const resolvedName = name || user?.displayName || user?.email;

    // Resolve image source precedence: explicit src prop > user.profileURL > user.photoURL
    const resolvedSrc =
      src || (user?.profileURL ?? undefined) || (user?.photoURL ?? undefined);

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

    return (
      <Avatar
        ref={ref}
        size={size}
        className={clsx(
          className,
          isBordered && "ring-2 ring-background",
          squared && "rounded-sm",
        )}
        color={color}
        as={as}
        role={finalRole}
        tabIndex={finalTabIndex}
        onClick={handleClick}
        name={resolvedName}
        {...rest}
      >
        {resolvedSrc && (
          <Avatar.Image src={resolvedSrc} alt={alt || resolvedName} />
        )}
        <Avatar.Fallback>{getInitials(resolvedName)}</Avatar.Fallback>
      </Avatar>
    );
  },
);
UserAvatar.displayName = "UserAvatar";

// Backwards compatibility export (if any old import remains)
export const AvatarExample = () => <UserAvatar name="Chris" />;
