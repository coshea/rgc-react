import {
  Button,
  Card,
  
  
  
  Separator,
} from "@heroui/react";
import BackButton from "@/components/back-button";

export function AnnualStartStep(props: {
  membershipAmountDue: number;
  currency: (amount: number) => string;
  isLoggedIn: boolean;
  hasPriorMembership: boolean;
  onBack: () => void;
  onLoginToRenew: () => void;
  onContinueRenew: () => void;
  onApplyNewMember: () => void;
}) {
  const {
    membershipAmountDue,
    currency,
    isLoggedIn,
    hasPriorMembership,
    onBack,
    onLoginToRenew,
    onContinueRenew,
    onApplyNewMember,
  } = props;

  const renewingCardClass = hasPriorMembership
    ? "rounded-2xl border-2 border-accent shadow-md"
    : "rounded-2xl border";

  const newMemberCardClass = hasPriorMembership
    ? "rounded-2xl border"
    : "rounded-2xl border-2 border-accent shadow-md";

  return (
    <Card className="w-full max-w-4xl">
      <Card.Header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
          <p className="text-sm text-foreground">
            New members should choose the application option.
          </p>
        </div>
        <BackButton onPress={onBack} />
      </Card.Header>
      <Separator />
      <Card.Content className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className={renewingCardClass}>
          <Card.Header className="pb-0">
            <h3 className="text-base font-semibold">
              I’m renewing (existing member)
            </h3>
          </Card.Header>
          <Card.Content className="pt-2 text-sm text-foreground space-y-3">
            <p>
              Renewals require signing in so we can automatically record your
              payment to your account.
            </p>
            <div>
              Annual Dues: <strong>{currency(membershipAmountDue)}</strong>
            </div>
          </Card.Content>
          <Card.Footer className="justify-end">
            {isLoggedIn ? (
              <Button  onPress={onContinueRenew}>
                Continue
              </Button>
            ) : (
              <Button  onPress={onLoginToRenew}>
                Log in to renew
              </Button>
            )}
          </Card.Footer>
        </Card>

        <Card className={newMemberCardClass}>
          <Card.Header className="pb-0">
            <h3 className="text-base font-semibold">I’m new (apply to join)</h3>
          </Card.Header>
          <Card.Content className="pt-2 text-sm text-foreground space-y-3">
            <p>
              First time joining? Choose this option. You’ll fill out a short
              application and then pay your dues.
            </p>
            {hasPriorMembership ? (
              <p className="text-warning">
                Looks like you’ve been a member before. Please use the renewal
                option instead.
              </p>
            ) : null}
            <div>
              Annual Dues: <strong>{currency(membershipAmountDue)}</strong>
            </div>
          </Card.Content>
          <Card.Footer className="justify-end">
            <Button
              
              onPress={onApplyNewMember}
              isDisabled={hasPriorMembership}
            >
              Apply &amp; Pay Dues
            </Button>
          </Card.Footer>
        </Card>
      </Card.Content>
    </Card>
  );
}
