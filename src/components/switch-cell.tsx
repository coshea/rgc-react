import React from "react";
import { Switch, cn } from "@heroui/react";
import type { SwitchProps } from "@heroui/react";

export type SwitchCellProps = SwitchProps & {
  label: string;
  description: string;
};

const SwitchCell = React.forwardRef<HTMLInputElement, SwitchCellProps>(
  ({ label, description, className, ...props }, ref) => (
    <Switch
      ref={ref}
      classNames={{
        base: cn(
          "inline-flex bg-content2 flex-row-reverse w-full max-w-full items-center",
          "justify-between cursor-pointer rounded-large gap-2 p-4",
          className,
        ),
        wrapper: "shrink-0",
      }}
      {...props}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-medium">{label}</p>
        <p className="text-small text-default-500">{description}</p>
      </div>
    </Switch>
  ),
);

SwitchCell.displayName = "SwitchCell";

export default SwitchCell;
