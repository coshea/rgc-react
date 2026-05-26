import { useState } from "react";
import { FieldError, Input, Label, TextField } from "@heroui/react";

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
};

function sanitizeAmountInput(nextValue: string) {
  const cleaned = nextValue.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned
      .slice(firstDot + 1)
      .replace(/\./g, "")
      .slice(0, 2)
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
}: DonationAmountInputProps) {
  const [amountFocused, setAmountFocused] = useState(false);

  return (
    <div className="space-y-1">
      <TextField
        value={amountFocused ? value : formatCurrency(value)}
        onChange={(v) => {
          if (v.trim().startsWith("-")) return;
          onValueChange(sanitizeAmountInput(v));
        }}
        isInvalid={isInvalid}
        isRequired={required}
        isDisabled={isDisabled}
      >
        <Label>{label}</Label>
        <Input
          aria-label={ariaLabel}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          onFocus={() => setAmountFocused(true)}
          onBlur={() => setAmountFocused(false)}
        />
        <FieldError>{errorMessage}</FieldError>
      </TextField>
      {description ? (
        <div className="text-xs text-muted">{description}</div>
      ) : null}
    </div>
  );
}
