import {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
} from "@heroui/react";

export function RenewConfirmStep(props: {
  email: string;
  loadingUserProfile: boolean;
  isPaidForCurrentYear: boolean;
  currentYear: number;
  membershipFoundName: string;
  membershipAmountDue: number;
  currency: (amount: number) => string;
  paypalEnabled: boolean;
  onBack: () => void;
  onDonation: () => void;
  onContinueToPay: () => void;
}) {
  const {
    email,
    loadingUserProfile,
    isPaidForCurrentYear,
    currentYear,
    membershipFoundName,
    membershipAmountDue,
    currency,
    paypalEnabled,
    onBack,
    onDonation,
    onContinueToPay,
  } = props;

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 3: Payment</h2>
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
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

        <div className="text-sm text-default-600">Amount Due</div>
        <div className="text-base font-semibold">
          {currency(membershipAmountDue)}
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button
          color="primary"
          onPress={onContinueToPay}
          isDisabled={isPaidForCurrentYear}
        >
          {paypalEnabled ? "Continue to PayPal" : "Pay Annual Dues"}
        </Button>
      </CardFooter>
    </Card>
  );
}
