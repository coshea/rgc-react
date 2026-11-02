import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import { EmptyState } from "@heroui-pro/react/empty-state";

interface EmptyStateMessageProps {
  title: ReactNode;
  /** Iconify name, e.g. "lucide:trophy". */
  icon?: string;
  description?: ReactNode;
  /** A button or link shown under the text. */
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** "Nothing here yet" for a page or section, built on HeroUI Pro EmptyState. */
export function EmptyStateMessage({
  title,
  icon,
  description,
  action,
  size = "md",
  className,
}: EmptyStateMessageProps) {
  return (
    <EmptyState size={size} className={className}>
      <EmptyState.Header>
        {icon && (
          <EmptyState.Media variant="icon">
            <Icon icon={icon} />
          </EmptyState.Media>
        )}
        <EmptyState.Title>{title}</EmptyState.Title>
        {description && (
          <EmptyState.Description>{description}</EmptyState.Description>
        )}
      </EmptyState.Header>
      {action && <EmptyState.Content>{action}</EmptyState.Content>}
    </EmptyState>
  );
}
