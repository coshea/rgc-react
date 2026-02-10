import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
} from "@heroui/react";
import BackButton from "@/components/back-button";
import { parseCurrencyInput } from "@/utils/currency";
import { DonationAmountInput } from "../DonationAmountInput";

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
    <Card className="w-full min-w-[320px] max-w-4xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 3: Review &amp; confirm</h2>
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
            <DonationAmountInput
              label="Optional donation"
              labelPlacement="inside"
              value={donationAmount}
              onValueChange={onDonationAmountChange}
              description="Add an optional donation to support the course through the Ridgefield Golf Club Improvement Fund (RGCIF)."
            />
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
