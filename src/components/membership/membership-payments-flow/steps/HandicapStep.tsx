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
import BackButton from "@/components/back-button";
import type { HandicapState } from "../types";

export function HandicapStep(props: {
  initialValue: HandicapState;
  profileName: string;
  profileEmail: string;
  profileGhin?: string | null;
  handicapFee: number;
  currency: (n: number) => string;
  onBack: () => void;
  onPay: (data: HandicapState) => Promise<void> | void;
}) {
  const {
    initialValue,
    profileName,
    profileEmail,
    handicapFee,
    currency,
    onBack,
    onPay,
  } = props;
  const [value, setValue] = useState<HandicapState>(initialValue);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    if (submitting) return;

    setLocalErrors({});

    setSubmitting(true);
    try {
      await onPay({ ...value, ghin: value.ghin.trim() });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
        <BackButton onPress={onBack} />
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        <h3 className="text-base font-semibold">Handicap Membership</h3>
        <p className="text-sm text-default-600">
          Provide your details below. If you don’t know your GHIN yet, you can
          leave it blank.
        </p>

        <div className="space-y-1 text-sm">
          <div>
            <span className="text-default-600">Name:</span> {profileName}
          </div>
          <div>
            <span className="text-default-600">Email:</span> {profileEmail}
          </div>
        </div>

        <Input
          label="GHIN (optional)"
          value={value.ghin}
          onValueChange={(v) =>
            setValue((s) => ({ ...s, ghin: v.replace(/\D+/g, "") }))
          }
          isInvalid={!!localErrors.handicapGhin}
          errorMessage={localErrors.handicapGhin}
          variant="bordered"
          inputMode="numeric"
          pattern="[0-9]*"
        />
        <div className="text-xs text-default-500">
          We’ll save this GHIN to your profile for future renewals.
        </div>
        <div className="text-sm">
          Fee: <strong>{currency(handicapFee)}</strong>
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button color="primary" onPress={handlePay} isLoading={submitting}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
