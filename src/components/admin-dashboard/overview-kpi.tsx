import type { ReactNode } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { KPI } from "@heroui-pro/react/kpi";

interface OverviewKpiProps {
  title: string;
  value: number;
  icon: string;
  /** Tints the icon with a KPI status color. */
  status?: "success" | "warning" | "danger";
  /** Icon tint for colors KPI has no status for (accent, secondary). */
  iconClassName?: string;
  className?: string;
  /** Breakdown under the value. */
  children?: ReactNode;
  /** Makes the whole tile pressable. `label` is the button's accessible name. */
  action?: { label: string; onPress: () => void };
}

/** A Member Overview stat tile. Must render inside a `<dl>`. */
export function OverviewKpi({
  title,
  value,
  icon,
  status,
  iconClassName,
  className,
  children,
  action,
}: OverviewKpiProps) {
  return (
    <KPI className={`${action ? "relative" : ""} ${className ?? ""}`}>
      <KPI.Header>
        <KPI.Icon status={status} className={iconClassName}>
          <Icon icon={icon} />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
      </KPI.Header>
      <KPI.Content>
        <KPI.Value value={value} />
      </KPI.Content>
      {children && (
        <KPI.Footer className="text-xs text-muted">{children}</KPI.Footer>
      )}
      {/* Laid over the tile rather than wrapping it, so the dt/dd never sit
          inside a <button>. */}
      {action && (
        <Button
          aria-label={action.label}
          onPress={action.onPress}
          className="absolute inset-0 h-auto w-full rounded-[inherit] bg-transparent p-0 hover:bg-default/20 data-[focus-visible=true]:ring-2"
        />
      )}
    </KPI>
  );
}
