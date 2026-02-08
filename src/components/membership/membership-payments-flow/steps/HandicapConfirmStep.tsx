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
import { parseCurrencyInput } from "@/utils/currency";

import type { HandicapState } from "../types";

export function HandicapConfirmStep(props: {
  handicap: HandicapState;
  profileName: string;
  profileEmail: string;
  handicapFee: number;
  donationAmount: string;
  currency: (amount: number) => string;
  onBack: () => void;
  onDonationAmountChange: (next: string) => void;
  onContinueToPay: (donationAmount: number) => void;
}) {
  const {
    handicap,
    profileName,
    profileEmail,
    handicapFee,
    donationAmount,
    currency,
    onBack,
    onDonationAmountChange,
    onContinueToPay,
  } = props;

  const donationValue = parseCurrencyInput(donationAmount);

  const total = handicapFee + donationValue;

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 3: Payment</h2>
        <BackButton onPress={onBack} />
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm text-default-600">Membership</div>
          <div className="text-base font-semibold">Handicap Only</div>
        </div>

        <div className="space-y-1">
          <div className="text-sm text-default-600">Details</div>
          <div className="text-sm">
            <div>
              <span className="text-default-600">Name:</span> {profileName}
            </div>
            <div>
              <span className="text-default-600">Email:</span> {profileEmail}
            </div>
            {handicap.ghin?.trim() ? (
              <div>
                <span className="text-default-600">GHIN:</span> {handicap.ghin}
              </div>
            ) : (
              <div>
                <span className="text-default-600">GHIN:</span> (not provided)
              </div>
            )}
          </div>
        </div>

        <Divider />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-default-600">Handicap fee</span>
            <span className="font-semibold">{currency(handicapFee)}</span>
          </div>
          <div className="mb-2">
            <Input
              label="Optional donation"
              labelPlacement="inside"
              value={donationAmount}
              onValueChange={(v) => {
                if (v.trim().startsWith("-")) return;
                onDonationAmountChange(v);
              }}
              variant="bordered"
              type="number"
              min={0}
              step="0.01"
              placeholder="$0"
            />
            <div className="mt-1 text-xs text-default-500">
              Add an optional donation to support the club.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-divider pt-2 font-bold">
          <span>Amount due</span>
          <span>{currency(total)}</span>
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button color="primary" onPress={() => onContinueToPay(donationValue)}>
          Pay Handicap Fee
        </Button>
      </CardFooter>
    </Card>
  );
}
