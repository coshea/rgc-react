import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Divider,
  Input,
} from "@heroui/react";
import { useState } from "react";
import type { NewMemberState } from "../types";

export function NewMemberApplicationStep(props: {
  initialValue: NewMemberState;
  membershipAmountDue: number;
  currency: (amount: number) => string;
  onBack: () => void;
  onSubmit: (data: NewMemberState) => void;
}) {
  const { initialValue, membershipAmountDue, currency, onBack, onSubmit } =
    props;
  const [value, setValue] = useState<NewMemberState>(initialValue);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  function isValidEmail(email: string) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  }

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!value.fullName.trim())
      nextErrors.newFullName = "Full name is required";
    if (!value.email.trim()) nextErrors.newEmail = "Email is required";
    else if (!isValidEmail(value.email))
      nextErrors.newEmail = "Enter a valid email";
    if (!value.phone.trim()) nextErrors.newPhone = "Phone number is required";
    if (!value.streetAddress.trim())
      nextErrors.newStreet = "Street address is required";
    if (!value.cityStateZip.trim())
      nextErrors.newCityStateZip = "City, State, ZIP is required";
    if (!value.acknowledged)
      nextErrors.newAcknowledged =
        "Please confirm you understand this is an application";

    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      ...value,
      fullName: value.fullName.trim(),
      email: value.email.trim(),
    });
  }

  return (
    <Card className="w-full max-w-4xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-base font-semibold">New Member Application</h3>
          <p className="text-sm text-default-600">
            Thank you for your interest in joining the club. Please complete the
            application below.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Personal Information</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Full Name"
              value={value.fullName}
              onValueChange={(v) => setValue((s) => ({ ...s, fullName: v }))}
              isInvalid={!!localErrors.newFullName}
              errorMessage={localErrors.newFullName}
              variant="bordered"
              required
            />
            <Input
              label="Email Address"
              value={value.email}
              onValueChange={(v) => setValue((s) => ({ ...s, email: v }))}
              isInvalid={!!localErrors.newEmail}
              errorMessage={localErrors.newEmail}
              variant="bordered"
              type="email"
              required
            />
            <Input
              label="Phone Number"
              value={value.phone}
              onValueChange={(v) => setValue((s) => ({ ...s, phone: v }))}
              isInvalid={!!localErrors.newPhone}
              errorMessage={localErrors.newPhone}
              variant="bordered"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Address</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Street Address"
              value={value.streetAddress}
              onValueChange={(v) =>
                setValue((s) => ({ ...s, streetAddress: v }))
              }
              isInvalid={!!localErrors.newStreet}
              errorMessage={localErrors.newStreet}
              variant="bordered"
              required
            />
            <Input
              label="City, State, ZIP"
              value={value.cityStateZip}
              onValueChange={(v) =>
                setValue((s) => ({ ...s, cityStateZip: v }))
              }
              isInvalid={!!localErrors.newCityStateZip}
              errorMessage={localErrors.newCityStateZip}
              variant="bordered"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Golf Information</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="GHIN Number (optional)"
              value={value.ghin}
              onValueChange={(v) => setValue((s) => ({ ...s, ghin: v }))}
              variant="bordered"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Checkbox
            isSelected={value.acknowledged}
            onValueChange={(v) => setValue((s) => ({ ...s, acknowledged: v }))}
          >
            I understand that this is an application for membership and is
            subject to approval.
          </Checkbox>
          {localErrors.newAcknowledged ? (
            <div className="text-danger text-sm">
              {localErrors.newAcknowledged}
            </div>
          ) : null}
        </div>

        <div className="text-sm">
          Annual Dues: <strong>{currency(membershipAmountDue)}</strong>
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button color="primary" onPress={handleSubmit}>
          Submit Application &amp; Pay Dues
        </Button>
      </CardFooter>
    </Card>
  );
}
