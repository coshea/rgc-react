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
import type { HandicapState } from "../types";

export function HandicapStep(props: {
  initialValue: HandicapState;
  handicapFee: number;
  currency: (n: number) => string;
  onBack: () => void;
  onPay: (data: HandicapState) => void;
}) {
  const { initialValue, handicapFee, currency, onBack, onPay } = props;
  const [value, setValue] = useState<HandicapState>(initialValue);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  function handlePay() {
    const nextErrors: Record<string, string> = {};

    if (!value.fullName?.trim())
      nextErrors.handicapFullName = "Name is required";
    if (!value.ghin.trim()) nextErrors.handicapGhin = "GHIN is required";

    if (value.email && value.email.trim()) {
      // basic sanity check
      const re = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!re.test(value.email.trim()))
        nextErrors.handicapEmail = "Enter a valid email";
    }

    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onPay({ ...value });
  }

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Handicap Lookup</h2>
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        <Input
          label="Full name"
          value={value.fullName}
          onValueChange={(v) => setValue((s) => ({ ...s, fullName: v }))}
          isInvalid={!!localErrors.handicapFullName}
          errorMessage={localErrors.handicapFullName}
          variant="bordered"
          required
        />

        <Input
          label="Email (optional)"
          value={value.email}
          onValueChange={(v) => setValue((s) => ({ ...s, email: v }))}
          isInvalid={!!localErrors.handicapEmail}
          errorMessage={localErrors.handicapEmail}
          variant="bordered"
          type="email"
        />

        <Input
          label="GHIN"
          value={value.ghin}
          onValueChange={(v) => setValue((s) => ({ ...s, ghin: v }))}
          isInvalid={!!localErrors.handicapGhin}
          errorMessage={localErrors.handicapGhin}
          variant="bordered"
          required
        />
        <div className="text-sm">
          Fee: <strong>{currency(handicapFee)}</strong>
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button color="primary" onPress={handlePay}>
          Lookup and Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
