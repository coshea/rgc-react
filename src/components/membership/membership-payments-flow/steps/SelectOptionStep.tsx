import { Button, Card, CardBody, CardFooter, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { MembershipOption } from "../types";

export function SelectOptionStep(props: {
  membershipOptionsDisabled: boolean;
  isLoggedIn: boolean;
  currentYear: number;
  membershipAmountDue: number;
  handicapFee: number;
  currency: (amount: number) => string;
  onSelectOption: (option: MembershipOption) => void;
}) {
  const {
    membershipOptionsDisabled,
    isLoggedIn,
    currentYear,
    membershipAmountDue,
    handicapFee,
    currency,
    onSelectOption,
  } = props;

  return (
    <div className="w-full max-w-6xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Step 1: Membership &amp; Support
        </h2>
        <p className="mt-2 text-sm text-default-600">
          Choose a membership option or support the club with a donation.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Card
          shadow="sm"
          className="relative rounded-2xl border border-default-200"
        >
          <CardHeader className="flex flex-col items-start gap-1">
            <h3 className="text-xl font-semibold">Handicap Membership</h3>
            <p className="text-sm text-default-600">
              Players looking only for a GHIN Handicap Index.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="text-3xl font-bold">{currency(handicapFee)}</div>

            <ul className="space-y-2 text-sm">
              {["GHIN Handicap Index", "Record scores"].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Icon
                    icon="lucide:check"
                    width={16}
                    height={16}
                    className="mt-0.5"
                  />
                  <span>{feature}</span>
                </li>
              ))}
              <li className="flex items-start gap-2 text-default-500">
                <Icon
                  icon="lucide:x"
                  width={16}
                  height={16}
                  className="mt-0.5 text-danger-500"
                />
                <span>Play in club tournaments</span>
              </li>
            </ul>
          </CardBody>
          <CardFooter className="pt-2">
            <Button
              fullWidth
              size="lg"
              color="primary"
              variant="flat"
              isDisabled={membershipOptionsDisabled || !isLoggedIn}
              onPress={() => onSelectOption("handicap")}
            >
              {membershipOptionsDisabled
                ? `Already paid for ${currentYear}`
                : !isLoggedIn
                  ? "Log in to join"
                  : "Join Handicap Only"}
            </Button>
          </CardFooter>
        </Card>

        <Card
          shadow="sm"
          className="relative rounded-2xl border-2 border-primary shadow-lg md:scale-[1.02]"
        >
          <CardHeader className="flex flex-col items-start gap-1">
            <h3 className="text-2xl font-bold">{currentYear} Membership</h3>
            <p className="text-sm text-default-600">
              Full access to club benefits for one year.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="text-4xl font-extrabold">
              {currency(membershipAmountDue)}
            </div>

            <ul className="space-y-2 text-sm">
              {[
                "GHIN Handicap Index",
                "Record scores",
                "Play in club tournaments",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Icon
                    icon="lucide:check"
                    width={16}
                    height={16}
                    className="mt-0.5"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardBody>
          <CardFooter className="pt-2">
            <Button
              fullWidth
              size="lg"
              color="primary"
              isDisabled={membershipOptionsDisabled}
              onPress={() => onSelectOption("renew")}
            >
              {membershipOptionsDisabled
                ? `Already paid for ${currentYear}`
                : `Join for ${currentYear}`}
            </Button>
          </CardFooter>
        </Card>

        <Card
          shadow="sm"
          className="relative rounded-2xl border border-default-200"
        >
          <CardHeader className="flex flex-col items-start gap-1">
            <h3 className="text-xl font-semibold">Donation Only</h3>
            <p className="text-sm text-default-600">
              Support the course through the Ridgefield Golf Club Improvement
              Fund (RGCIF) with a donation.
            </p>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="text-3xl font-bold">Pay what you want</div>

            <ul className="space-y-2 text-sm">
              {["No membership required", "Support the course"].map(
                (feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Icon
                      icon="lucide:check"
                      width={16}
                      height={16}
                      className="mt-0.5"
                    />
                    <span>{feature}</span>
                  </li>
                ),
              )}
            </ul>
          </CardBody>
          <CardFooter className="pt-2">
            <Button
              fullWidth
              size="lg"
              color="primary"
              variant="flat"
              onPress={() => onSelectOption("donation")}
            >
              Donate
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
