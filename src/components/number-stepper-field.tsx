import type { ReactNode } from "react";
import { FieldError, Label } from "@heroui/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { NumberFieldContext } from "react-aria-components";

interface NumberStepperFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Visible label. Pass `aria-label` instead when the field has none. */
  label?: string;
  "aria-label"?: string;
  minValue?: number;
  maxValue?: number;
  /** Render without a thousands separator (2026, not 2,026). */
  isYear?: boolean;
  isDisabled?: boolean;
  className?: string;
  /** Helper text under the stepper. */
  description?: ReactNode;
  /** Marks the field invalid and shows this under it. */
  errorMessage?: string;
}

const YEAR_FORMAT = { useGrouping: false };

const stepButton = "size-11 sm:size-10";
// Pro takes the hidden input and both buttons out of the tab order, which
// leaves the stepper unreachable by keyboard. Keep the buttons tabbable.

/**
 * A -/+ stepper for small whole numbers (years, counts, ordering). The value
 * can't be typed, so use a text field for money or values that may be empty.
 */
export function NumberStepperField({
  value,
  onChange,
  label,
  "aria-label": ariaLabel,
  minValue,
  maxValue,
  isYear = false,
  isDisabled,
  className,
  description,
  errorMessage,
}: NumberStepperFieldProps) {
  const formatOptions = isYear ? YEAR_FORMAT : undefined;

  // NumberStepper formats its visible value but doesn't pass formatOptions to
  // the NumberField underneath, so the announced value would read "2,026".
  return (
    <NumberFieldContext.Provider value={{ formatOptions }}>
      <NumberStepper
        size="lg"
        value={value}
        onChange={(next) => {
          if (Number.isFinite(next)) onChange(next);
        }}
        minValue={minValue}
        maxValue={maxValue}
        isDisabled={isDisabled}
        isInvalid={!!errorMessage}
        aria-label={ariaLabel}
        formatOptions={formatOptions}
        className={`flex-col items-start gap-1 ${className ?? ""}`}
      >
        {label && <Label>{label}</Label>}
        <NumberStepper.Group>
          <NumberStepper.DecrementButton
            className={stepButton}
            excludeFromTabOrder={false}
          />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton
            className={stepButton}
            excludeFromTabOrder={false}
          />
        </NumberStepper.Group>
        {description && <p className="text-xs text-muted">{description}</p>}
        <FieldError>{errorMessage}</FieldError>
      </NumberStepper>
    </NumberFieldContext.Provider>
  );
}
