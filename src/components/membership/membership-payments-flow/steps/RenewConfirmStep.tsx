import {
  Alert,
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

export function RenewConfirmStep(props: {
  email: string;
  loadingUserProfile: boolean;
  isPaidForCurrentYear: boolean;
  currentYear: number;
  membershipFoundName: string;
  membershipAmountDue: number;
  donationAmount: string;
  currency: (amount: number) => string;
  paypalEnabled: boolean;
  onBack: () => void;
  onDonation: () => void;
  onDonationAmountChange: (next: string) => void;
  onContinueToPay: (donationAmount: number) => void;
}) {
  const {
    email,
    loadingUserProfile,
    isPaidForCurrentYear,
    currentYear,
    membershipFoundName,
    membershipAmountDue,
    donationAmount,
    currency,
    paypalEnabled,
    onBack,
    onDonation,
    onDonationAmountChange,
    onContinueToPay,
  } = props;

  const donationValue = parseCurrencyInput(donationAmount);
  const total = membershipAmountDue + donationValue;

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 3: Payment</h2>
        <BackButton onPress={onBack} />
      </CardHeader>
      <Divider />
      <CardBody className="space-y-3">
        <div className="text-sm text-default-600">
          Signed in as {email}
          {loadingUserProfile ? " (loading profile…)" : ""}
        </div>

        {isPaidForCurrentYear ? (
          <Alert color="success">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Your annual dues are already recorded for {currentYear}. You
                don&apos;t need to pay again.
              </div>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={onDonation}
              >
                Make a donation
              </Button>
            </div>
          </Alert>
        ) : null}

        <div className="text-sm text-default-600">Name</div>
        <div className="text-base font-semibold">{membershipFoundName}</div>

        <Divider />

        <div className="text-sm text-default-600">Membership</div>
        <div className="text-base">Annual Club Membership</div>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-default-600">Annual dues</div>
            <div className="text-base font-semibold">
              {currency(membershipAmountDue)}
            </div>
          </div>

          <div className="w-full max-w-sm">
            <div className="text-sm text-default-600">Optional donation</div>
            <Input
              aria-label="Optional donation"
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
              isDisabled={isPaidForCurrentYear}
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
        <Button
          color="primary"
          onPress={() => onContinueToPay(donationValue)}
          isDisabled={isPaidForCurrentYear}
        >
          {paypalEnabled ? "Continue to Payment" : "Pay Annual Dues"}
        </Button>
      </CardFooter>
    </Card>
  );
}
