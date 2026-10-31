import { Segment } from "@heroui-pro/react/segment";
import { T_SHIRT_SIZES } from "@/api/users";
import { NO_SEGMENT_SELECTION } from "@/utils/segment";

type ShirtSizePickerProps = {
  value: string;
  onChange: (size: string) => void;
  isInvalid?: boolean;
  /** Stretch the picker to fill the row (phone sheet). */
  fullWidth?: boolean;
};

export function ShirtSizePicker({
  value,
  onChange,
  isInvalid = false,
  fullWidth = false,
}: ShirtSizePickerProps) {
  return (
    <Segment
      aria-label="T-shirt size"
      // React Aria drops aria-invalid here; forms show the error text beside it.
      data-invalid={isInvalid || undefined}
      size="lg"
      selectedKey={value || NO_SEGMENT_SELECTION}
      onSelectionChange={(key) => onChange(String(key))}
      className={`max-w-full data-[invalid=true]:ring-2 data-[invalid=true]:ring-danger ${fullWidth ? "w-full" : ""}`}
    >
      {T_SHIRT_SIZES.map((size) => (
        <Segment.Item key={size} id={size} className="h-11 px-2 font-semibold">
          {size}
        </Segment.Item>
      ))}
    </Segment>
  );
}
