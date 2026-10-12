import React from "react";
import { Switch } from "@heroui/react";

type GoldTeeSwitchProps = {
  isSelected: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
};

/**
 * Gold (senior) tees default. The explanation is shown inline so the old
 * "Info" modal isn't needed. Text sits on the left and the switch on the
 * right; the switch is labelled and described by the text via ids.
 */
export function GoldTeeSwitch({
  isSelected,
  onChange,
  isDisabled = false,
}: GoldTeeSwitchProps) {
  const id = React.useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <div className="flex w-full items-center justify-between gap-4 py-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p id={labelId} className="font-medium">
          Default to gold tees
        </p>
        <p id={descriptionId} className="text-sm text-muted">
          Seniors only. Gold tees are pre-selected when you register for a
          tournament or are added to a team.
        </p>
      </div>
      <Switch
        isSelected={isSelected}
        onChange={onChange}
        isDisabled={isDisabled}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        className="shrink-0"
      >
        {/* Switch.Content renders the real input; the control must sit inside it. */}
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}
