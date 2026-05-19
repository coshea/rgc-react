import React from "react";
import { Switch, cn } from "@heroui/react";
import type { SwitchProps } from "@heroui/react";

export type SwitchCellProps = SwitchProps & {
  label: string;
  description: string;
};

const SwitchCell = React.forwardRef<HTMLLabelElement, SwitchCellProps>(
  ({ label, description, className, ...props }, ref) => (
    <div
      className={cn(
        "flex items-center justify-between gap-4 bg-surface-secondary rounded-lg p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 flex-1">
        <p className="text-base">{label}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <Switch ref={ref} classNames={{ wrapper: "shrink-0" }} {...props} />
    </div>
  ),
);

SwitchCell.displayName = "SwitchCell";

export default SwitchCell;
