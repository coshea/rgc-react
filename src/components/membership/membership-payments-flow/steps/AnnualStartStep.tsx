import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
} from "@heroui/react";

export function AnnualStartStep(props: {
  membershipAmountDue: number;
  currency: (amount: number) => string;
  isLoggedIn: boolean;
  onBack: () => void;
  onLoginToRenew: () => void;
  onContinueRenew: () => void;
  onApplyNewMember: () => void;
}) {
  const {
    membershipAmountDue,
    currency,
    isLoggedIn,
    onBack,
    onLoginToRenew,
    onContinueRenew,
    onApplyNewMember,
  } = props;

  return (
    <Card className="w-full max-w-4xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
          <p className="text-sm text-default-600">
            New members should choose the application option.
          </p>
        </div>
        <Button variant="light" onPress={onBack}>
          Back
        </Button>
      </CardHeader>
      <Divider />
      <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-default-200" shadow="none">
          <CardHeader className="pb-0">
            <h3 className="text-base font-semibold">
              I’m renewing (existing member)
            </h3>
          </CardHeader>
          <CardBody className="pt-2 text-sm text-default-600 space-y-3">
            <p>
              Renewals require signing in so we can automatically record your
              payment to your account.
            </p>
            <div>
              Annual Dues: <strong>{currency(membershipAmountDue)}</strong>
            </div>
          </CardBody>
          <CardFooter className="justify-end">
            {isLoggedIn ? (
              <Button color="primary" onPress={onContinueRenew}>
                Continue
              </Button>
            ) : (
              <Button color="primary" onPress={onLoginToRenew}>
                Log in to renew
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card
          className="rounded-2xl border-2 border-primary shadow-md"
          shadow="none"
        >
          <CardHeader className="pb-0">
            <h3 className="text-base font-semibold">I’m new (apply to join)</h3>
          </CardHeader>
          <CardBody className="pt-2 text-sm text-default-600 space-y-3">
            <p>
              First time joining? Choose this option. You’ll fill out a short
              application and then pay your dues.
            </p>
            <div>
              Annual Dues: <strong>{currency(membershipAmountDue)}</strong>
            </div>
          </CardBody>
          <CardFooter className="justify-end">
            <Button color="primary" onPress={onApplyNewMember}>
              Apply &amp; Pay Dues
            </Button>
          </CardFooter>
        </Card>
      </CardBody>
    </Card>
  );
}
