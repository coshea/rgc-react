import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { T_SHIRT_SIZES } from "@/api/users";

type ShirtSizePickerProps = {
  value: string;
  onChange: (size: string) => void;
  isInvalid?: boolean;
  /** Stretch the buttons to fill the row (phone sheet). */
  fullWidth?: boolean;
};

export function ShirtSizePicker({
  value,
  onChange,
  isInvalid = false,
  fullWidth = false,
}: ShirtSizePickerProps) {
  return (
    <ToggleButtonGroup
      aria-label="T-shirt size"
      aria-invalid={isInvalid || undefined}
      selectionMode="single"
      disallowEmptySelection
      isDetached
      fullWidth={fullWidth}
      selectedKeys={value ? [value] : []}
      onSelectionChange={(keys) => {
        const [next] = Array.from(keys);
        if (next !== undefined) onChange(String(next));
      }}
      className="flex-wrap gap-1.5"
    >
      {T_SHIRT_SIZES.map((size) => (
        <ToggleButton
          key={size}
          id={size}
          className="h-11 min-w-12 px-3 font-semibold"
        >
          {size}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
