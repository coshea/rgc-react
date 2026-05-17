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
        "flex items-center justify-between gap-4 bg-content2 rounded-large p-4",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 flex-1">
        <p className="text-medium">{label}</p>
        <p className="text-small text-default-500">{description}</p>
      </div>
      <Switch ref={ref} classNames={{ wrapper: "shrink-0" }} {...props} />
    </div>
  ),
);

SwitchCell.displayName = "SwitchCell";

export default SwitchCell;
