import { useState } from "react";
import { Input } from "@heroui/react";

export type DonationAmountInputProps = {
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  ariaLabel?: string;
  isInvalid?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  required?: boolean;
  description?: string;
  placeholder?: string;
  labelPlacement?: "inside" | "outside" | "outside-left";
};

function sanitizeAmountInput(nextValue: string) {
  const cleaned = nextValue.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

function formatCurrency(amount: string) {
  const numeric = parseFloat(amount);
  if (!amount.trim() || Number.isNaN(numeric)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function DonationAmountInput({
  label,
  value,
  onValueChange,
  ariaLabel,
  isInvalid,
  errorMessage,
  isDisabled,
  required,
  description,
  placeholder = "$0",
  labelPlacement,
}: DonationAmountInputProps) {
  const [amountFocused, setAmountFocused] = useState(false);

  return (
    <div className="space-y-1">
      <Input
        aria-label={ariaLabel}
        label={label}
        labelPlacement={labelPlacement}
        value={amountFocused ? value : formatCurrency(value)}
        onValueChange={(nextValue) => {
          if (nextValue.trim().startsWith("-")) return;
          onValueChange(sanitizeAmountInput(nextValue));
        }}
        onFocus={() => setAmountFocused(true)}
        onBlur={() => setAmountFocused(false)}
        isInvalid={isInvalid}
        errorMessage={errorMessage}
        variant="bordered"
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        isDisabled={isDisabled}
        required={required}
      />
      {description ? (
        <div className="text-xs text-default-500">{description}</div>
      ) : null}
    </div>
  );
}
