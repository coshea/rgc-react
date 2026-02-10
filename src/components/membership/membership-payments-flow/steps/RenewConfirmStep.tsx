import {
  Alert,
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

export function RenewConfirmStep(props: {
  email: string;
  loadingUserProfile: boolean;
  isPaidForCurrentYear: boolean;
  currentYear: number;
  membershipFoundName: string;
  membershipAmountDue: number;
  membershipApplicationUrl?: string;
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
    membershipApplicationUrl,
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
  const hasApplicationUrl = Boolean(membershipApplicationUrl);

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 3: Review &amp; confirm</h2>
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
              <Button size="sm" color="primary" onPress={onDonation}>
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

        <Alert color="primary">
          <div className="space-y-2">
            <div className="font-semibold">Referral program</div>
            <p className="text-sm text-foreground-600">
              If you are doing the referral for a new member, they will need to
              complete the application before we can apply the referral. To
              receive the discount, choose the "Pay by check (mail)" option on
              the next screen and include the referring member&apos;s name in
              the memo.
            </p>
            <div>
              <Button
                as={hasApplicationUrl ? "a" : "button"}
                href={hasApplicationUrl ? membershipApplicationUrl : undefined}
                target={hasApplicationUrl ? "_blank" : undefined}
                rel={hasApplicationUrl ? "noreferrer" : undefined}
                size="sm"
                variant="flat"
                isDisabled={!hasApplicationUrl}
              >
                {hasApplicationUrl
                  ? "Download Application PDF"
                  : "PDF unavailable"}
              </Button>
            </div>
            {!hasApplicationUrl ? (
              <p className="text-xs text-warning">
                The application PDF has not been configured yet. Please check
                back soon.
              </p>
            ) : null}
          </div>
        </Alert>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-default-600">Annual dues</div>
            <div className="text-base font-semibold">
              {currency(membershipAmountDue)}
            </div>
          </div>

          <div className="w-full max-w-sm">
            <DonationAmountInput
              ariaLabel="Optional donation"
              label="Optional donation"
              value={donationAmount}
              onValueChange={onDonationAmountChange}
              isDisabled={isPaidForCurrentYear}
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
