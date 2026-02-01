import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Input,
} from "@heroui/react";
import { useState } from "react";
import type { RenewLookupState } from "../types";
import BackButton from "@/components/back-button";

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

export function RenewLookupStep(props: {
  initialValue: RenewLookupState;
  onBack: () => void;
  onSubmit: (data: RenewLookupState) => void;
}) {
  const { initialValue, onBack, onSubmit } = props;

  const [value, setValue] = useState<RenewLookupState>(initialValue);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  function handleContinue() {
    const nextErrors: Record<string, string> = {};
    if (!value.email.trim()) nextErrors.renewEmail = "Email is required";
    else if (!isValidEmail(value.email))
      nextErrors.renewEmail = "Enter a valid email";

    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ email: value.email.trim(), lastName: value.lastName.trim() });
  }

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
        <BackButton onPress={onBack} />
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        <h3 className="text-base font-semibold">Renew Your Membership</h3>
        <p className="text-sm text-default-600">
          Please enter the email address associated with your membership.
        </p>

        <Input
          label="Email Address"
          value={value.email}
          onValueChange={(v) =>
            setValue((s: RenewLookupState) => ({ ...s, email: v }))
          }
          isInvalid={!!localErrors.renewEmail}
          errorMessage={localErrors.renewEmail}
          variant="bordered"
          type="email"
          required
        />

        <Input
          label="Last Name (optional)"
          value={value.lastName}
          onValueChange={(v) =>
            setValue((s: RenewLookupState) => ({ ...s, lastName: v }))
          }
          variant="bordered"
        />
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button color="primary" onPress={handleContinue}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
