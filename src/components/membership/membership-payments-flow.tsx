import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PayPalButtons,
  PayPalScriptProvider,
  type PayPalButtonsComponentProps,
} from "@paypal/react-paypal-js";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Alert,
  Checkbox,
  Divider,
  Input,
  Spacer,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatUSD } from "@/config/membership-pricing";
import { siteConfig } from "@/config/site";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/providers/AuthProvider";
import MinimalRowSteps from "@/components/minimal-row-steps";
import { verifyAndRecordPayPalMembershipPayment } from "@/api/paypal";

type MembershipOption = "renew" | "new" | "handicap" | "donation";

type Step =
  | { kind: "select" }
  | { kind: "renew_lookup" }
  | { kind: "renew_confirm"; email: string; lastName?: string }
  | { kind: "new_apply" }
  | { kind: "handicap" }
  | { kind: "donation" }
  | {
      kind: "paypal";
      purpose: MembershipOption;
      title: string;
      description: string;
      amount: number;
    }
  | {
      kind: "done";
      title: string;
      description: string;
    };

interface RenewLookupState {
  email: string;
  lastName: string;
}

interface NewMemberState {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  cityStateZip: string;
  ghin: string;
  homeCourse: string;
  acknowledged: boolean;
}

interface HandicapState {
  fullName: string;
  email: string;
  ghin: string;
}

interface DonationState {
  amount: string;
  name: string;
  email: string;
}

export interface MembershipPaymentsFlowProps {
  membershipAmountDue: number;
  handicapFee: number;
  loginFromPath?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

export default function MembershipPaymentsFlow({
  membershipAmountDue,
  handicapFee,
  loginFromPath = siteConfig.pages.membership.link,
}: MembershipPaymentsFlowProps) {
  const currency = formatUSD;

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
  const paypalEnvironmentRaw = import.meta.env.VITE_PAYPAL_ENVIRONMENT;
  const paypalEnvironment =
    typeof paypalEnvironmentRaw === "string" && paypalEnvironmentRaw.trim()
      ? paypalEnvironmentRaw.trim().toUpperCase()
      : "SANDBOX";
  const showPayPalSandboxNotice = paypalEnvironment === "SANDBOX";

  const paypalCurrency: string = "USD";
  const isVitest = Boolean(import.meta.env.VITEST);
  const paypalEnabled =
    !isVitest &&
    typeof paypalClientId === "string" &&
    paypalClientId.trim().length > 0;

  const demoPaymentsEnabled = isVitest;

  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    userProfile,
    isLoading: loadingUserProfile,
    refetch: refetchUserProfile,
  } = useUserProfile();

  const isPaidForCurrentYear =
    !!user && (userProfile?.lastPaidYear ?? 0) >= currentYear;

  const membershipOptionsDisabled = user ? isPaidForCurrentYear : false;

  const [step, setStep] = useState<Step>({ kind: "select" });

  const [renewLookup, setRenewLookup] = useState<RenewLookupState>({
    email: "",
    lastName: "",
  });

  const [newMember, setNewMember] = useState<NewMemberState>({
    fullName: "",
    email: "",
    phone: "",
    streetAddress: "",
    cityStateZip: "",
    ghin: "",
    homeCourse: "",
    acknowledged: false,
  });

  const [handicap, setHandicap] = useState<HandicapState>({
    fullName: "",
    email: "",
    ghin: "",
  });

  const [donation, setDonation] = useState<DonationState>({
    amount: "",
    name: "",
    email: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepsCount = 4;
  const currentStepIndex = useMemo(() => {
    if (step.kind === "select") return 0;
    if (step.kind === "renew_lookup") return 1;
    if (step.kind === "new_apply") return 1;
    if (step.kind === "handicap") return 1;
    if (step.kind === "donation") return 1;
    if (step.kind === "renew_confirm") return 2;
    if (step.kind === "paypal") return 2;
    if (step.kind === "done") return 3;
    return 0;
  }, [step.kind]);

  const stepTitles = useMemo(
    () => ["Select option", "Confirm details", "Payment", "Complete"],
    []
  );

  const stepLabel = `Step ${currentStepIndex + 1} of ${stepsCount}: ${
    stepTitles[currentStepIndex]
  }`;

  function onStepperChange(next: number) {
    // Only allow moving backwards. Moving forward should happen via form actions.
    if (next >= currentStepIndex) return;

    if (next === 0) {
      goToSelect();
      return;
    }

    // Step 2 means “confirm details”; we can only return to renew lookup from renew_confirm.
    if (next === 1) {
      if (step.kind === "renew_confirm") {
        setStep({ kind: "renew_lookup" });
      }
      return;
    }
  }

  function goToSelect() {
    setStep({ kind: "select" });
    setErrors({});
  }

  function goToPayPalPayment(params: {
    purpose: MembershipOption;
    title: string;
    description: string;
    amount: number;
  }) {
    setErrors({});
    setStep({ kind: "paypal", ...params });
  }

  const createPayPalOrder: PayPalButtonsComponentProps["createOrder"] = (
    _data,
    actions
  ) => {
    if (step.kind !== "paypal") {
      return actions.order.create({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: "Membership payment",
            amount: {
              currency_code: paypalCurrency,
              value: "0.01",
            },
          },
        ],
      });
    }

    const value = Number.isFinite(step.amount)
      ? step.amount.toFixed(2)
      : "0.01";

    const customId =
      user &&
      (step.purpose === "renew" || step.purpose === "handicap") &&
      `${user.uid}:${currentYear}:${step.purpose === "renew" ? "full" : "handicap"}:${step.purpose}`;

    return actions.order.create({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: step.title,
          amount: {
            currency_code: paypalCurrency,
            value,
          },
          ...(customId ? { custom_id: customId } : {}),
        },
      ],
    });
  };

  const onPayPalApprove: PayPalButtonsComponentProps["onApprove"] = async (
    data,
    actions
  ) => {
    if (!actions.order) {
      console.error("PayPal order actions were unavailable", { step, user });
      addToast({
        title: "Payment error",
        description: "PayPal order actions were unavailable.",
        color: "danger",
      });
      return;
    }

    // Capture first; then record a Firestore payment record via a trusted backend
    // (Firestore rules restrict memberPayments writes to admins).
    await actions.order.capture();

    if (step.kind !== "paypal") {
      setStep({
        kind: "done",
        title: "Payment complete",
        description: "Payment captured successfully.",
      });
      return;
    }

    const paid = currency(step.amount);
    const titleByPurpose: Record<MembershipOption, string> = {
      renew: "Payment Recorded",
      new: "Application Submitted",
      handicap: "Payment Recorded",
      donation: "Thank You",
    };

    const doneTitleByPurpose: Record<MembershipOption, string> = {
      renew: "Payment complete",
      new: "Application submitted",
      handicap: "Payment complete",
      donation: "Thank you",
    };

    const descriptionByPurpose: Record<MembershipOption, string> = {
      renew: `Annual dues payment of ${paid} captured successfully.`,
      new: `Application submitted and dues of ${paid} captured successfully.`,
      handicap: `Handicap fee of ${paid} captured successfully.`,
      donation: `Donation of ${paid} captured successfully.`,
    };

    addToast({
      title: titleByPurpose[step.purpose],
      description: descriptionByPurpose[step.purpose],
      color: "success",
    });

    // Record dues payments (renew/handicap) after a successful PayPal capture.
    // This uses a callable Cloud Function that verifies the PayPal order server-side
    // and then writes memberPayments/users with admin privileges.
    if (
      user &&
      (step.purpose === "renew" || step.purpose === "handicap") &&
      data.orderID
    ) {
      try {
        const membershipType = step.purpose === "renew" ? "full" : "handicap";
        await verifyAndRecordPayPalMembershipPayment({
          user,
          request: {
            orderId: data.orderID,
            year: currentYear,
            membershipType,
            purpose: step.purpose,
          },
        });
        await refetchUserProfile();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Unknown recording error";
        console.error("verifyAndRecordPayPalMembershipPayment failed", {
          error: e,
          uid: user?.uid,
          orderId: data?.orderID,
        });
        addToast({
          title: "Payment captured, but not recorded",
          description:
            "Your PayPal payment succeeded, but we couldn't record it automatically. Please contact the club with your PayPal receipt. " +
            message,
          color: "danger",
        });
      }
    }

    setStep({
      kind: "done",
      title: doneTitleByPurpose[step.purpose],
      description: descriptionByPurpose[step.purpose],
    });
  };

  const onPayPalError: PayPalButtonsComponentProps["onError"] = (err) => {
    const message = err instanceof Error ? err.message : "Unknown PayPal error";
    console.error("PayPal error", { err });
    addToast({
      title: "Payment failed",
      description: message,
      color: "danger",
    });
  };

  function selectOption(option: MembershipOption) {
    setErrors({});

    // If a signed-in member has already paid for the current year, prevent
    // duplicate dues payments and steer them to Donation instead.
    if (membershipOptionsDisabled && option !== "donation") {
      addToast({
        title: "Already paid",
        description: `Your ${currentYear} payment is already recorded. You can still make a donation.`,
        color: "success",
      });
      return;
    }

    if (option === "renew") {
      if (!user) {
        addToast({
          title: "Login required",
          description:
            "Please log in to renew. We'll use your account details automatically.",
          color: "warning",
        });
        navigate(siteConfig.pages.login.link, {
          state: { from: loginFromPath },
        });
        return;
      }

      const email = user.email || userProfile?.email || "";
      if (!email) {
        addToast({
          title: "Cannot renew",
          description:
            "Your account doesn't have an email address on file. Please contact the club.",
          color: "danger",
        });
        return;
      }

      setStep({
        kind: "renew_confirm",
        email,
        lastName: userProfile?.lastName,
      });
      return;
    }
    if (option === "new") setStep({ kind: "new_apply" });
    if (option === "handicap") setStep({ kind: "handicap" });
    if (option === "donation") setStep({ kind: "donation" });
  }

  function onContinueRenewLookup() {
    const nextErrors: Record<string, string> = {};
    if (!renewLookup.email.trim()) nextErrors.renewEmail = "Email is required";
    else if (!isValidEmail(renewLookup.email))
      nextErrors.renewEmail = "Enter a valid email";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStep({
      kind: "renew_confirm",
      email: renewLookup.email.trim(),
      lastName: renewLookup.lastName.trim() || undefined,
    });
  }

  function onPayRenew() {
    if (isPaidForCurrentYear) {
      addToast({
        title: "Already paid",
        description: `Your annual dues are already recorded for ${currentYear}.`,
        color: "success",
      });
      return;
    }

    if (paypalEnabled) {
      goToPayPalPayment({
        purpose: "renew",
        title: "Annual Club Membership",
        description: "Annual dues payment",
        amount: membershipAmountDue,
      });
      return;
    }

    if (!demoPaymentsEnabled) {
      addToast({
        title: "PayPal not configured",
        description:
          "PayPal is not configured for this environment (missing VITE_PAYPAL_CLIENT_ID).",
        color: "warning",
      });
      goToPayPalPayment({
        purpose: "renew",
        title: "Annual Club Membership",
        description: "Annual dues payment",
        amount: membershipAmountDue,
      });
      return;
    }

    addToast({
      title: "Payment Recorded",
      description: `Annual dues payment of ${currency(
        membershipAmountDue
      )} recorded (demo).`,
      color: "success",
    });
    setStep({
      kind: "done",
      title: "Payment complete",
      description: `Annual dues payment of ${currency(
        membershipAmountDue
      )} recorded (demo).`,
    });
  }

  function onSubmitNewAndPay() {
    const nextErrors: Record<string, string> = {};

    if (!newMember.fullName.trim())
      nextErrors.newFullName = "Full name is required";
    if (!newMember.email.trim()) nextErrors.newEmail = "Email is required";
    else if (!isValidEmail(newMember.email))
      nextErrors.newEmail = "Enter a valid email";
    if (!newMember.phone.trim())
      nextErrors.newPhone = "Phone number is required";

    if (!newMember.streetAddress.trim())
      nextErrors.newStreet = "Street address is required";
    if (!newMember.cityStateZip.trim())
      nextErrors.newCityStateZip = "City, State, ZIP is required";

    if (!newMember.acknowledged)
      nextErrors.newAcknowledged =
        "Please confirm you understand this is an application";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (paypalEnabled) {
      goToPayPalPayment({
        purpose: "new",
        title: "Annual Club Membership",
        description: "New member application dues",
        amount: membershipAmountDue,
      });
      return;
    }

    if (!demoPaymentsEnabled) {
      addToast({
        title: "PayPal not configured",
        description:
          "PayPal is not configured for this environment (missing VITE_PAYPAL_CLIENT_ID).",
        color: "warning",
      });
      goToPayPalPayment({
        purpose: "new",
        title: "Annual Club Membership",
        description: "New member application dues",
        amount: membershipAmountDue,
      });
      return;
    }

    addToast({
      title: "Application Submitted",
      description: `Application submitted and dues of ${currency(
        membershipAmountDue
      )} recorded (demo).`,
      color: "success",
    });
    setStep({
      kind: "done",
      title: "Application submitted",
      description: `Application submitted and dues of ${currency(
        membershipAmountDue
      )} recorded (demo).`,
    });
  }

  function onPayHandicap() {
    const nextErrors: Record<string, string> = {};
    if (!handicap.fullName.trim())
      nextErrors.handicapFullName = "Full name is required";
    if (!handicap.email.trim()) nextErrors.handicapEmail = "Email is required";
    else if (!isValidEmail(handicap.email))
      nextErrors.handicapEmail = "Enter a valid email";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (paypalEnabled) {
      goToPayPalPayment({
        purpose: "handicap",
        title: "Handicap Membership",
        description: "Handicap membership fee",
        amount: handicapFee,
      });
      return;
    }

    if (!demoPaymentsEnabled) {
      addToast({
        title: "PayPal not configured",
        description:
          "PayPal is not configured for this environment (missing VITE_PAYPAL_CLIENT_ID).",
        color: "warning",
      });
      goToPayPalPayment({
        purpose: "handicap",
        title: "Handicap Membership",
        description: "Handicap membership fee",
        amount: handicapFee,
      });
      return;
    }

    addToast({
      title: "Payment Recorded",
      description: `Handicap fee of ${currency(handicapFee)} recorded (demo).`,
      color: "success",
    });
    setStep({
      kind: "done",
      title: "Payment complete",
      description: `Handicap fee of ${currency(handicapFee)} recorded (demo).`,
    });
  }

  function onPayDonation() {
    const nextErrors: Record<string, string> = {};
    const amount = parseFloat(donation.amount);

    if (!donation.amount.trim())
      nextErrors.donationAmount = "Donation amount is required";
    else if (Number.isNaN(amount) || amount <= 0)
      nextErrors.donationAmount = "Enter an amount greater than 0";

    if (donation.email.trim() && !isValidEmail(donation.email))
      nextErrors.donationEmail = "Enter a valid email";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (paypalEnabled) {
      goToPayPalPayment({
        purpose: "donation",
        title: "Donation",
        description: "Club donation",
        amount,
      });
      return;
    }

    if (!demoPaymentsEnabled) {
      addToast({
        title: "PayPal not configured",
        description:
          "PayPal is not configured for this environment (missing VITE_PAYPAL_CLIENT_ID).",
        color: "warning",
      });
      goToPayPalPayment({
        purpose: "donation",
        title: "Donation",
        description: "Club donation",
        amount,
      });
      return;
    }

    addToast({
      title: "Thank You",
      description: `Donation of ${currency(amount)} recorded (demo).`,
      color: "success",
    });
    setStep({
      kind: "done",
      title: "Thank you",
      description: `Donation of ${currency(amount)} recorded (demo).`,
    });
  }

  const membershipFoundName = useMemo(() => {
    if (step.kind !== "renew_confirm") return null;

    const profileName =
      userProfile?.displayName?.trim() ||
      [userProfile?.firstName?.trim(), userProfile?.lastName?.trim()]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      user?.displayName?.trim() ||
      "";
    if (profileName) return profileName;

    const localPart = step.email.split("@")[0] ?? "";
    const guess = localPart
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

    return guess || "Member";
  }, [
    step,
    user?.displayName,
    userProfile?.displayName,
    userProfile?.firstName,
    userProfile?.lastName,
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16">
      <div className="w-full max-w-4xl">
        <MinimalRowSteps
          currentStep={currentStepIndex}
          stepsCount={stepsCount}
          label={stepLabel}
          onStepChange={onStepperChange}
        />
      </div>

      <Spacer y={6} />

      {user && isPaidForCurrentYear && step.kind === "select" && (
        <div className="w-full max-w-4xl">
          <Alert color="success">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                Your annual dues are already recorded for {currentYear}. Thank
                you!
              </div>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={() => selectOption("donation")}
              >
                Make a donation
              </Button>
            </div>
          </Alert>
          <Spacer y={4} />
        </div>
      )}

      {step.kind === "select" && (
        <Card className="w-full max-w-4xl" shadow="sm">
          <CardHeader className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Step 1: Select option</h2>
            <p className="text-sm text-default-600">Membership & Payments</p>
          </CardHeader>
          <Divider />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card
                isPressable={!membershipOptionsDisabled}
                onPress={() => selectOption("renew")}
                role="button"
                aria-label="Renew Membership"
                className={
                  membershipOptionsDisabled
                    ? "border border-default-200 opacity-60"
                    : "border border-default-200 hover:bg-content2"
                }
              >
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:refresh-ccw" width={18} height={18} />
                    <h3 className="font-semibold">Renew Membership</h3>
                  </div>
                  <p className="text-sm text-default-600">
                    {membershipOptionsDisabled
                      ? `Annual dues already paid for ${currentYear}`
                      : "For current members paying annual dues"}
                  </p>
                </CardBody>
              </Card>

              <Card
                isPressable={!membershipOptionsDisabled}
                onPress={() => selectOption("new")}
                role="button"
                aria-label="New Member Application"
                className={
                  membershipOptionsDisabled
                    ? "border border-default-200 opacity-60"
                    : "border border-default-200 hover:bg-content2"
                }
              >
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:user-plus" width={18} height={18} />
                    <h3 className="font-semibold">New Member Application</h3>
                  </div>
                  <p className="text-sm text-default-600">
                    {membershipOptionsDisabled
                      ? "Unavailable after payment"
                      : "Apply to join the club"}
                  </p>
                </CardBody>
              </Card>

              <Card
                isPressable={!membershipOptionsDisabled}
                onPress={() => selectOption("handicap")}
                role="button"
                aria-label="Handicap Index Only"
                className={
                  membershipOptionsDisabled
                    ? "border border-default-200 opacity-60"
                    : "border border-default-200 hover:bg-content2"
                }
              >
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:golf" width={18} height={18} />
                    <h3 className="font-semibold">Handicap Index Only</h3>
                  </div>
                  <p className="text-sm text-default-600">
                    {membershipOptionsDisabled
                      ? "Unavailable after payment"
                      : "GHIN handicap without club membership"}
                  </p>
                </CardBody>
              </Card>

              <Card
                isPressable
                onPress={() => selectOption("donation")}
                role="button"
                aria-label="Make a Donation"
                className="border border-default-200 hover:bg-content2"
              >
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:hand-heart" width={18} height={18} />
                    <h3 className="font-semibold">Make a Donation</h3>
                  </div>
                  <p className="text-sm text-default-600">Support the club</p>
                </CardBody>
              </Card>
            </div>
          </CardBody>
        </Card>
      )}

      {step.kind === "renew_lookup" && (
        <Card className="w-full max-w-3xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
            <Button variant="light" onPress={goToSelect}>
              Back
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-4">
            <h3 className="text-base font-semibold">Renew Your Membership</h3>
            <p className="text-sm text-default-600">
              Please enter the email address associated with your membership.
            </p>

            <Input
              label="Email Address"
              value={renewLookup.email}
              onValueChange={(v) => setRenewLookup((s) => ({ ...s, email: v }))}
              isInvalid={!!errors.renewEmail}
              errorMessage={errors.renewEmail}
              variant="bordered"
              type="email"
              required
            />

            <Input
              label="Last Name (optional)"
              value={renewLookup.lastName}
              onValueChange={(v) =>
                setRenewLookup((s) => ({ ...s, lastName: v }))
              }
              variant="bordered"
            />
          </CardBody>
          <Divider />
          <CardFooter className="flex justify-end">
            <Button color="primary" onPress={onContinueRenewLookup}>
              Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {step.kind === "renew_confirm" && (
        <Card className="w-full max-w-3xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 3: Payment</h2>
            <Button variant="light" onPress={goToSelect}>
              Back
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-3">
            <div className="text-sm text-default-600">
              Signed in as {step.email}
              {loadingUserProfile ? " (loading profile…)" : ""}
            </div>

            {isPaidForCurrentYear ? (
              <Alert color="success">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    Your annual dues are already recorded for {currentYear}. You
                    don't need to pay again.
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => setStep({ kind: "donation" })}
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
              onPress={onPayRenew}
              isDisabled={isPaidForCurrentYear}
            >
              {paypalEnabled ? "Continue to PayPal" : "Pay Annual Dues"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step.kind === "paypal" && (
        <Card className="w-full max-w-3xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 3: Payment</h2>
            <Button variant="light" onPress={goToSelect}>
              Back
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-4 overflow-visible">
            {paypalEnabled && showPayPalSandboxNotice && (
              <Alert color="warning">
                PayPal is running in SANDBOX mode. Payments are not live.
              </Alert>
            )}

            <div>
              <div className="text-sm text-default-600">{step.title}</div>
              <div className="text-base font-semibold">{step.description}</div>
            </div>

            <div>
              <div className="text-sm text-default-600">Amount</div>
              <div className="text-base font-semibold">
                {currency(step.amount)}
              </div>
            </div>

            {paypalEnabled ? (
              <div className="w-full">
                <PayPalScriptProvider
                  options={{
                    clientId: paypalClientId,
                    currency: paypalCurrency,
                    intent: "capture",
                    disableFunding: "paylater",
                  }}
                >
                  <PayPalButtons
                    style={{ layout: "vertical" }}
                    createOrder={createPayPalOrder}
                    onApprove={onPayPalApprove}
                    onError={onPayPalError}
                  />
                </PayPalScriptProvider>
              </div>
            ) : (
              <div className="text-sm text-default-600">
                PayPal is not configured (missing `VITE_PAYPAL_CLIENT_ID`).
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {step.kind === "new_apply" && (
        <Card className="w-full max-w-4xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
            <Button variant="light" onPress={goToSelect}>
              Back
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">
                New Member Application
              </h3>
              <p className="text-sm text-default-600">
                Thank you for your interest in joining the club. Please complete
                the application below.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Personal Information</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Full Name"
                  value={newMember.fullName}
                  onValueChange={(v) =>
                    setNewMember((s) => ({ ...s, fullName: v }))
                  }
                  isInvalid={!!errors.newFullName}
                  errorMessage={errors.newFullName}
                  variant="bordered"
                  required
                />
                <Input
                  label="Email Address"
                  value={newMember.email}
                  onValueChange={(v) =>
                    setNewMember((s) => ({ ...s, email: v }))
                  }
                  isInvalid={!!errors.newEmail}
                  errorMessage={errors.newEmail}
                  variant="bordered"
                  type="email"
                  required
                />
                <Input
                  label="Phone Number"
                  value={newMember.phone}
                  onValueChange={(v) =>
                    setNewMember((s) => ({ ...s, phone: v }))
                  }
                  isInvalid={!!errors.newPhone}
                  errorMessage={errors.newPhone}
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
                  value={newMember.streetAddress}
                  onValueChange={(v) =>
                    setNewMember((s) => ({ ...s, streetAddress: v }))
                  }
                  isInvalid={!!errors.newStreet}
                  errorMessage={errors.newStreet}
                  variant="bordered"
                  required
                />
                <Input
                  label="City, State, ZIP"
                  value={newMember.cityStateZip}
                  onValueChange={(v) =>
                    setNewMember((s) => ({ ...s, cityStateZip: v }))
                  }
                  isInvalid={!!errors.newCityStateZip}
                  errorMessage={errors.newCityStateZip}
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
                  value={newMember.ghin}
                  onValueChange={(v) =>
                    setNewMember((s) => ({ ...s, ghin: v }))
                  }
                  variant="bordered"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Checkbox
                isSelected={newMember.acknowledged}
                onValueChange={(v) =>
                  setNewMember((s) => ({ ...s, acknowledged: v }))
                }
              >
                I understand that this is an application for membership and is
                subject to approval.
              </Checkbox>
              {errors.newAcknowledged ? (
                <div className="text-danger text-sm">
                  {errors.newAcknowledged}
                </div>
              ) : null}
            </div>

            <div className="text-sm">
              Annual Dues: <strong>{currency(membershipAmountDue)}</strong>
            </div>
          </CardBody>
          <Divider />
          <CardFooter className="flex justify-end">
            <Button color="primary" onPress={onSubmitNewAndPay}>
              Submit Application & Pay Dues
            </Button>
          </CardFooter>
        </Card>
      )}

      {step.kind === "handicap" && (
        <Card className="w-full max-w-3xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
            <Button variant="light" onPress={goToSelect}>
              Back
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-4">
            <h3 className="text-base font-semibold">
              Handicap Index Registration
            </h3>
            <p className="text-sm text-default-600">
              Register for a GHIN handicap index through the club.
            </p>

            <Input
              label="Full Name"
              value={handicap.fullName}
              onValueChange={(v) => setHandicap((s) => ({ ...s, fullName: v }))}
              isInvalid={!!errors.handicapFullName}
              errorMessage={errors.handicapFullName}
              variant="bordered"
              required
            />
            <Input
              label="Email Address"
              value={handicap.email}
              onValueChange={(v) => setHandicap((s) => ({ ...s, email: v }))}
              isInvalid={!!errors.handicapEmail}
              errorMessage={errors.handicapEmail}
              variant="bordered"
              type="email"
              required
            />
            <Input
              label="GHIN Number (if transferring from another club)"
              value={handicap.ghin}
              onValueChange={(v) => setHandicap((s) => ({ ...s, ghin: v }))}
              variant="bordered"
            />

            <div className="text-sm">
              Fee: <strong>{currency(handicapFee)}</strong>
            </div>
          </CardBody>
          <Divider />
          <CardFooter className="flex justify-end">
            <Button color="primary" onPress={onPayHandicap}>
              Pay Handicap Fee
            </Button>
          </CardFooter>
        </Card>
      )}

      {step.kind === "donation" && (
        <Card className="w-full max-w-3xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 2: Confirm details</h2>
            <Button variant="light" onPress={goToSelect}>
              Back
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-4">
            <h3 className="text-base font-semibold">Support the Club</h3>
            <p className="text-sm text-default-600">
              Your contribution helps support club events, improvements, and
              operations.
            </p>

            <Input
              label="Donation Amount ($)"
              value={donation.amount}
              onValueChange={(v) => setDonation((s) => ({ ...s, amount: v }))}
              isInvalid={!!errors.donationAmount}
              errorMessage={errors.donationAmount}
              variant="bordered"
              type="number"
              min={0}
              required
            />

            <Input
              label="Name (optional)"
              value={donation.name}
              onValueChange={(v) => setDonation((s) => ({ ...s, name: v }))}
              variant="bordered"
            />

            <Input
              label="Email (optional)"
              value={donation.email}
              onValueChange={(v) => setDonation((s) => ({ ...s, email: v }))}
              isInvalid={!!errors.donationEmail}
              errorMessage={errors.donationEmail}
              variant="bordered"
              type="email"
            />
          </CardBody>
          <Divider />
          <CardFooter className="flex justify-end">
            <Button color="primary" onPress={onPayDonation}>
              Make Donation
            </Button>
          </CardFooter>
        </Card>
      )}

      {step.kind === "done" && (
        <Card className="w-full max-w-3xl" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Step 4: Complete</h2>
            <Button variant="light" onPress={goToSelect}>
              Start over
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="space-y-3">
            <h3 className="text-base font-semibold">{step.title}</h3>
            <p className="text-sm text-default-600">{step.description}</p>
          </CardBody>
          <Divider />
          <CardFooter className="flex justify-end">
            <Button color="primary" onPress={goToSelect}>
              Back to options
            </Button>
          </CardFooter>
        </Card>
      )}

      <Spacer y={8} />
      <div className="w-full max-w-4xl text-center text-sm text-default-500 space-y-2">
        <div>For questions, please contact the club directly.</div>
        <div className="italic">
          Thank you for being part of our club community.
        </div>
      </div>
    </div>
  );
}
