import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Input,
} from "@heroui/react";
import type { DonationState } from "../types";

export function DonationStep(props: {
  initialValue: DonationState;
  onBack: () => void;
  onPay: (data: DonationState) => void;
}) {
  const { initialValue, onBack, onPay } = props;
  const [value, setValue] = useState<DonationState>(initialValue);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  function isValidEmail(email: string) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  }

  function handlePay() {
    const nextErrors: Record<string, string> = {};
    const amount = parseFloat(value.amount);

    if (!value.amount.trim())
      nextErrors.donationAmount = "Donation amount is required";
    else if (Number.isNaN(amount) || amount <= 0)
      nextErrors.donationAmount = "Enter an amount greater than 0";

    if (value.email.trim() && !isValidEmail(value.email))
      nextErrors.donationEmail = "Enter a valid email";

    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onPay({ ...value, amount: value.amount.trim() });
  }

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        <h3 className="text-base font-semibold">Support the Club</h3>
        <p className="text-sm text-default-600">
          Your contribution helps support club events, improvements, and
          operations.
        </p>

        <Input
          label="Donation Amount ($)"
          value={value.amount}
          onValueChange={(v) => {
            if (v.trim().startsWith("-")) return;
            setValue((s) => ({ ...s, amount: v }));
          }}
          isInvalid={!!localErrors.donationAmount}
          errorMessage={localErrors.donationAmount}
          variant="bordered"
          type="number"
          min={0}
          step={"0.01"}
          required
        />

        <Input
          label="Name (optional)"
          value={value.name}
          onValueChange={(v) => setValue((s) => ({ ...s, name: v }))}
          variant="bordered"
        />

        <Input
          label="Email (optional)"
          value={value.email}
          onValueChange={(v) => setValue((s) => ({ ...s, email: v }))}
          isInvalid={!!localErrors.donationEmail}
          errorMessage={localErrors.donationEmail}
          variant="bordered"
          type="email"
        />
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button
          color="primary"
          className="w-full font-bold uppercase tracking-wide"
          onPress={handlePay}
        >
          Make Donation
        </Button>
      </CardFooter>
    </Card>
  );
}
