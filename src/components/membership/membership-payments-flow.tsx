import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type PayPalButtonsComponentProps } from "@paypal/react-paypal-js";
import { Spacer, addToast } from "@heroui/react";
import { formatUSD } from "@/config/membership-pricing";
import { siteConfig } from "@/config/site";
import { logger } from "@/config/sentry";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/providers/AuthProvider";
import MinimalRowSteps from "@/components/minimal-row-steps";
import {
  verifyAndRecordPayPalDonationPayment,
  verifyAndRecordPayPalMembershipPayment,
} from "@/api/paypal";
import { requestCheckMembershipPayment } from "@/api/membership";
import { saveUserProfile } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";

import type {
  DonationState,
  HandicapState,
  MembershipOption,
  NewMemberState,
  Step,
} from "./membership-payments-flow/types";
import { AlreadyPaidNotice } from "./membership-payments-flow/steps/AlreadyPaidNotice";
import { AnnualStartStep } from "./membership-payments-flow/steps/AnnualStartStep";
import { DonationStep } from "./membership-payments-flow/steps/DonationStep";
import { DoneStep } from "./membership-payments-flow/steps/DoneStep";
import { HandicapStep } from "./membership-payments-flow/steps/HandicapStep";
import { HandicapConfirmStep } from "./membership-payments-flow/steps/HandicapConfirmStep";
import { NewMemberApplicationStep } from "./membership-payments-flow/steps/NewMemberApplicationStep";
import { PayPalStep } from "./membership-payments-flow/steps/PayPalStep";
import { RenewConfirmStep } from "./membership-payments-flow/steps/RenewConfirmStep";
import { SelectOptionStep } from "./membership-payments-flow/steps/SelectOptionStep";

export interface MembershipPaymentsFlowProps {
  membershipAmountDue: number;
  handicapFee: number;
  membershipApplicationUrl?: string;
  loginFromPath?: string;
}

export default function MembershipPaymentsFlow({
  membershipAmountDue,
  handicapFee,
  membershipApplicationUrl,
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
  const hasPriorMembership = (userProfile?.lastPaidYear ?? 0) > 0;

  const membershipOptionsDisabled = user ? isPaidForCurrentYear : false;

  const [step, setStep] = useState<Step>({ kind: "select" });

  const [annualDonationAmount, setAnnualDonationAmount] = useState<string>("");
  const [handicapDonationAmount, setHandicapDonationAmount] =
    useState<string>("");

  const [newMember, setNewMember] = useState<NewMemberState>({
    acknowledged: false,
  });

  const [handicap, setHandicap] = useState<HandicapState>({
    ghin: "",
  });

  const [donation, setDonation] = useState<DonationState>({
    amount: "",
    name: "",
    email: "",
  });

  // Per-step validation is now handled within individual step components.

  const stepsCount = 5;
  const currentStepIndex = useMemo(() => {
    if (step.kind === "select") return 0;
    if (step.kind === "annual_start") return 1;
    if (step.kind === "new_apply") return 1;
    if (step.kind === "handicap") return 1;
    if (step.kind === "donation") return 1;
    if (step.kind === "renew_confirm") return 2;
    if (step.kind === "handicap_confirm") return 2;
    if (step.kind === "paypal") return 3;
    if (step.kind === "done") return 4;
    return 0;
  }, [step.kind]);

  const stepTitles = useMemo(
    () => [
      "Select option",
      "Confirm details",
      "Review & confirm",
      "Submit payment",
      "Complete",
    ],
    [],
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
        setStep({ kind: "annual_start" });
      }

      if (step.kind === "handicap_confirm") {
        setStep({ kind: "handicap" });
      }

      if (step.kind === "paypal") {
        if (step.purpose === "renew") setStep({ kind: "annual_start" });
        if (step.purpose === "new") setStep({ kind: "new_apply" });
        if (step.purpose === "handicap") setStep({ kind: "handicap" });
        if (step.purpose === "donation") setStep({ kind: "donation" });
      }
      return;
    }
  }

  function goToSelect() {
    setStep({ kind: "select" });
  }

  function goToPayPalPayment(params: {
    purpose: MembershipOption;
    title: string;
    description: string;
    amount: number;
    returnTo: Step;
  }) {
    setStep({ kind: "paypal", ...params });
  }

  const createPayPalOrder: PayPalButtonsComponentProps["createOrder"] = (
    _data,
    actions,
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
      `${user.uid}:${currentYear}:${step.purpose === "renew" ? MEMBERSHIP_TYPES.FULL : MEMBERSHIP_TYPES.HANDICAP}:${step.purpose}`;

    const invoiceId =
      user && (step.purpose === "renew" || step.purpose === "handicap")
        ? `RGCM-${currentYear}-${user.uid}-${step.purpose}`
        : null;

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
          ...(invoiceId ? { invoice_id: invoiceId } : {}),
        },
      ],
    });
  };

  const onPayPalApprove: PayPalButtonsComponentProps["onApprove"] = async (
    data,
    actions,
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

    let clientCaptureErrorMessage: string | null = null;
    try {
      await actions.order.capture();
    } catch (captureError) {
      clientCaptureErrorMessage =
        captureError instanceof Error
          ? captureError.message
          : "Unknown client capture error";

      logger.warn("PayPal client capture failed; falling back to server", {
        orderId: data.orderID ?? null,
        uid: user?.uid ?? null,
        purpose: step.kind === "paypal" ? step.purpose : null,
        message: clientCaptureErrorMessage,
      });
    }

    const membershipTypeForLog =
      step.kind === "paypal" &&
      (step.purpose === "renew" || step.purpose === "handicap")
        ? step.purpose === "renew"
          ? MEMBERSHIP_TYPES.FULL
          : MEMBERSHIP_TYPES.HANDICAP
        : null;

    logger.info("PayPal payment approval received", {
      orderId: data.orderID ?? null,
      uid: user?.uid ?? null,
      purpose: step.kind === "paypal" ? step.purpose : null,
      membershipType: membershipTypeForLog,
      amount: step.kind === "paypal" ? step.amount : null,
      currency: paypalCurrency,
      year: currentYear,
      environment: paypalEnvironment,
      clientCaptureSucceeded: !clientCaptureErrorMessage,
    });

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
      new: "Payment Recorded",
      handicap: "Payment Recorded",
      donation: "Thank You",
    };

    const doneTitleByPurpose: Record<MembershipOption, string> = {
      renew: "Payment complete",
      new: "Payment complete",
      handicap: "Payment complete",
      donation: "Thank you",
    };

    const descriptionByPurpose: Record<MembershipOption, string> = {
      renew: `Annual dues payment of ${paid} captured successfully.`,
      new: `Dues payment of ${paid} captured successfully. Please mail your completed application to the club.`,
      handicap: `Handicap fee of ${paid} captured successfully.`,
      donation: `Donation of ${paid} captured successfully.`,
    };

    // Record dues or donation payments after a successful PayPal capture.
    // This uses callable Cloud Functions that verify/capture the PayPal order server-side
    // and then write memberPayments/users with admin privileges.
    if (user && data.orderID) {
      try {
        if (step.purpose === "renew" || step.purpose === "handicap") {
          const membershipType =
            step.purpose === "renew"
              ? MEMBERSHIP_TYPES.FULL
              : MEMBERSHIP_TYPES.HANDICAP;
          const verifyResp = await verifyAndRecordPayPalMembershipPayment({
            user,
            request: {
              orderId: data.orderID,
              year: currentYear,
              membershipType,
              purpose: step.purpose,
            },
          });

          if (!verifyResp.ok) {
            throw new Error(
              `PayPal order not completed (status: ${verifyResp.paypalStatus ?? "unknown"}).`,
            );
          }

          await refetchUserProfile();
        }

        if (step.purpose === "donation") {
          const verifyResp = await verifyAndRecordPayPalDonationPayment({
            user,
            request: {
              orderId: data.orderID,
              year: currentYear,
            },
          });

          if (!verifyResp.ok) {
            throw new Error(
              `PayPal order not completed (status: ${verifyResp.paypalStatus ?? "unknown"}).`,
            );
          }
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Unknown recording error";
        console.error("verifyAndRecordPayPal payment failed. " + message, {
          error: e,
          uid: user?.uid,
          orderId: data?.orderID,
        });
        addToast({
          title: "Payment captured, but not recorded",
          description:
            "Your PayPal payment succeeded, but we couldn't record it automatically. Please contact the club with your PayPal receipt. ",
          color: "danger",
        });
        return;
      }
    } else if (clientCaptureErrorMessage) {
      addToast({
        title: "Payment verification needed",
        description:
          "We couldn't confirm this Venmo payment automatically. Please try again or contact the club if your payment was charged.",
        color: "warning",
      });
      return;
    }

    addToast({
      title: titleByPurpose[step.purpose],
      description: descriptionByPurpose[step.purpose],
      color: "success",
    });

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
    // clear per-step errors handled by the steps themselves

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

    if (option === "renew" || option === "new") {
      setStep({ kind: "annual_start" });
      return;
    }
    if (option === "handicap") {
      if (!user) {
        addToast({
          title: "Login required",
          description:
            "Please log in to purchase a handicap-only membership so we can attach it to your profile.",
          color: "warning",
        });
        navigate(siteConfig.pages.login.link, {
          state: { from: loginFromPath },
        });
        return;
      }
      setStep({ kind: "handicap" });
      return;
    }
    if (option === "donation") {
      if (!user) {
        addToast({
          title: "Login required",
          description:
            "Please log in to make a donation so we can record it to your account.",
          color: "warning",
        });
        navigate(siteConfig.pages.login.link, {
          state: { from: loginFromPath },
        });
        return;
      }
      setStep({ kind: "donation" });
    }
  }

  function onContinueRenewFromAnnualStart() {
    if (!user) {
      addToast({
        title: "Login required",
        description:
          "Please log in to renew so we can record your payment to your account.",
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
  }

  function onPayRenew(donationAmount: number) {
    if (isPaidForCurrentYear) {
      addToast({
        title: "Already paid",
        description: `Your annual dues are already recorded for ${currentYear}.`,
        color: "success",
      });
      return;
    }

    const donation =
      Number.isFinite(donationAmount) && donationAmount > 0
        ? donationAmount
        : 0;
    const totalAmount = membershipAmountDue + donation;
    const donationText =
      donation > 0 ? ` plus donation of ${currency(donation)}` : "";

    const returnTo =
      step.kind === "renew_confirm" ? step : { kind: "annual_start" as const };

    handlePaymentDecision({
      purpose: "renew",
      title: "Annual Club Membership",
      description: "Annual dues payment",
      amount: totalAmount,
      returnTo,
      demoTitle: "Payment Recorded",
      demoDescription: `Annual dues payment of ${currency(membershipAmountDue)}${donationText} recorded (demo).`,
      doneTitle: "Payment complete",
      doneDescription: `Annual dues payment of ${currency(membershipAmountDue)}${donationText} recorded (demo).`,
    });
  }

  function handlePaymentDecision(params: {
    purpose: MembershipOption;
    title: string;
    description: string;
    amount: number;
    returnTo: Step;
    demoTitle: string;
    demoDescription: string;
    doneTitle: string;
    doneDescription: string;
  }) {
    const {
      purpose,
      title,
      description,
      amount,
      returnTo,
      demoTitle,
      demoDescription,
      doneTitle,
      doneDescription,
    } = params;

    if (paypalEnabled) {
      goToPayPalPayment({ purpose, title, description, amount, returnTo });
      return;
    }

    if (!demoPaymentsEnabled) {
      addToast({
        title: "PayPal not configured",
        description:
          "PayPal is not configured for this environment (missing VITE_PAYPAL_CLIENT_ID).",
        color: "warning",
      });
      goToPayPalPayment({ purpose, title, description, amount, returnTo });
      return;
    }

    addToast({
      title: demoTitle,
      description: demoDescription,
      color: "success",
    });
    setStep({ kind: "done", title: doneTitle, description: doneDescription });
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

  const handicapProfileName =
    userProfile?.displayName?.trim() ||
    [userProfile?.firstName?.trim(), userProfile?.lastName?.trim()]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user?.displayName?.trim() ||
    user?.email ||
    "Member";

  const handicapProfileEmail = user?.email || userProfile?.email || "";
  const handicapProfileGhin = userProfile?.ghinNumber?.trim() || "";

  useEffect(() => {
    if (handicapProfileGhin && !handicap.ghin) {
      setHandicap((prev) => ({ ...prev, ghin: handicapProfileGhin }));
    }
  }, [handicapProfileGhin, handicap.ghin]);

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
        <AlreadyPaidNotice
          currentYear={currentYear}
          onDonationPress={() => selectOption("donation")}
        />
      )}

      {step.kind === "select" && (
        <SelectOptionStep
          membershipOptionsDisabled={membershipOptionsDisabled}
          isLoggedIn={!!user}
          currentYear={currentYear}
          membershipAmountDue={membershipAmountDue}
          handicapFee={handicapFee}
          currency={currency}
          onSelectOption={selectOption}
        />
      )}

      {step.kind === "annual_start" && (
        <AnnualStartStep
          membershipAmountDue={membershipAmountDue}
          currency={currency}
          isLoggedIn={!!user}
          hasPriorMembership={hasPriorMembership}
          onBack={goToSelect}
          onLoginToRenew={() =>
            navigate(siteConfig.pages.login.link, {
              state: { from: loginFromPath },
            })
          }
          onContinueRenew={onContinueRenewFromAnnualStart}
          onApplyNewMember={() => {
            if (hasPriorMembership) {
              addToast({
                title: "Already a member",
                description:
                  "Your profile already has a recorded membership year. Please renew instead.",
                color: "warning",
              });
              return;
            }
            setStep({ kind: "new_apply" });
          }}
        />
      )}

      {step.kind === "renew_confirm" && (
        <RenewConfirmStep
          email={step.email}
          loadingUserProfile={loadingUserProfile}
          isPaidForCurrentYear={isPaidForCurrentYear}
          currentYear={currentYear}
          membershipFoundName={membershipFoundName ?? ""}
          membershipAmountDue={membershipAmountDue}
          membershipApplicationUrl={membershipApplicationUrl}
          donationAmount={annualDonationAmount}
          currency={currency}
          paypalEnabled={paypalEnabled}
          onBack={() => setStep({ kind: "annual_start" })}
          onDonation={() => setStep({ kind: "donation" })}
          onDonationAmountChange={setAnnualDonationAmount}
          onContinueToPay={onPayRenew}
        />
      )}

      {step.kind === "paypal" && (
        <PayPalStep
          paypalEnabled={paypalEnabled}
          showPayPalSandboxNotice={showPayPalSandboxNotice}
          paypalClientId={paypalClientId ?? ""}
          paypalCurrency={paypalCurrency}
          title={step.title}
          description={step.description}
          amount={step.amount}
          currency={currency}
          createOrder={createPayPalOrder}
          onApprove={onPayPalApprove}
          onError={onPayPalError}
          onBack={() => setStep(step.returnTo)}
          onCheckSelected={async () => {
            if (!user) {
              addToast({
                title: "Login required",
                description:
                  "Please log in so we can attach the check payment to your account.",
                color: "warning",
              });
              navigate(siteConfig.pages.login.link, {
                state: { from: loginFromPath },
              });
              return;
            }

            if (step.purpose !== "renew" && step.purpose !== "handicap") {
              addToast({
                title: "Check payments unavailable",
                description:
                  "Pay-by-check is only available for membership dues. Please use PayPal for this option.",
                color: "warning",
              });
              return;
            }

            const membershipType =
              step.purpose === "renew"
                ? MEMBERSHIP_TYPES.FULL
                : MEMBERSHIP_TYPES.HANDICAP;
            const donationRaw =
              step.purpose === "renew"
                ? annualDonationAmount
                : handicapDonationAmount;
            const donationParsed = Number(donationRaw);
            const donationAmount =
              Number.isFinite(donationParsed) && donationParsed > 0
                ? donationParsed
                : 0;

            const requestId =
              typeof crypto !== "undefined" &&
              "randomUUID" in crypto &&
              typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

            try {
              await requestCheckMembershipPayment({
                user,
                request: {
                  year: currentYear,
                  membershipType,
                  donationAmount,
                  requestId,
                },
              });

              addToast({
                title: "Check option selected",
                description: `Please mail a check payable to ${siteConfig.contactAddress.name} to ${siteConfig.contactAddress.street}, ${siteConfig.contactAddress.cityStateZip} and include your name and membership year in the memo.`,
                color: "success",
              });
              setStep({
                kind: "done",
                title: "Pending: Check Sent",
                description: `Please mail your check to:\n${siteConfig.contactAddress.name}\n${siteConfig.contactAddress.street},\n${siteConfig.contactAddress.cityStateZip} and include your full name and the membership year in the memo so we can match it to your account. We will record your payment once the check is received.`,
              });
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Check request failed";
              addToast({
                title: "Check request failed",
                description: message,
                color: "danger",
              });
            }
          }}
        />
      )}

      {step.kind === "new_apply" && (
        <NewMemberApplicationStep
          initialValue={newMember}
          membershipApplicationUrl={membershipApplicationUrl}
          contactAddress={siteConfig.contactAddress}
          membershipAmountDue={membershipAmountDue}
          currency={currency}
          onBack={() => setStep({ kind: "annual_start" })}
          onSubmit={(data) => {
            setNewMember(data);
            handlePaymentDecision({
              purpose: "new",
              title: "Annual Club Membership",
              description: "New member dues payment",
              amount: membershipAmountDue,
              returnTo: { kind: "new_apply" },
              demoTitle: "Payment Recorded",
              demoDescription: `Dues of ${currency(
                membershipAmountDue,
              )} recorded (demo). Please mail your completed application.`,
              doneTitle: "Payment complete",
              doneDescription: `Dues of ${currency(
                membershipAmountDue,
              )} recorded (demo). Please mail your completed application.`,
            });
          }}
        />
      )}

      {step.kind === "handicap" && (
        <HandicapStep
          initialValue={handicap}
          profileName={handicapProfileName}
          profileEmail={handicapProfileEmail}
          profileGhin={handicapProfileGhin}
          handicapFee={handicapFee}
          currency={currency}
          onBack={goToSelect}
          onPay={async (data) => {
            setHandicap(data);
            const nextGhin = data.ghin.trim();
            if (user && nextGhin && nextGhin !== handicapProfileGhin) {
              try {
                await saveUserProfile(user.uid, {
                  ghinNumber: nextGhin,
                });
                await refetchUserProfile();
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : "Failed to save GHIN";
                addToast({
                  title: "GHIN not saved",
                  description: message,
                  color: "warning",
                });
              }
            }
            setStep({ kind: "handicap_confirm" });
          }}
        />
      )}

      {step.kind === "handicap_confirm" && (
        <HandicapConfirmStep
          handicap={handicap}
          profileName={handicapProfileName}
          profileEmail={handicapProfileEmail}
          handicapFee={handicapFee}
          donationAmount={handicapDonationAmount}
          currency={currency}
          onBack={() => setStep({ kind: "handicap" })}
          onDonationAmountChange={setHandicapDonationAmount}
          onContinueToPay={(donationAmount) => {
            const donation =
              Number.isFinite(donationAmount) && donationAmount > 0
                ? donationAmount
                : 0;
            const totalAmount = handicapFee + donation;
            const donationText =
              donation > 0 ? ` plus donation of ${currency(donation)}` : "";

            handlePaymentDecision({
              purpose: "handicap",
              title: "Handicap Only",
              description: "GHIN Handicap fee",
              amount: totalAmount,
              returnTo: { kind: "handicap_confirm" },
              demoTitle: "Payment Recorded",
              demoDescription: `Handicap fee of ${currency(handicapFee)}${donationText} recorded (demo).`,
              doneTitle: "Payment complete",
              doneDescription: `Handicap fee of ${currency(handicapFee)}${donationText} recorded (demo).`,
            });
          }}
        />
      )}

      {step.kind === "donation" && (
        <DonationStep
          initialValue={donation}
          onBack={goToSelect}
          onPay={(data) => {
            setDonation(data);
            const amount = parseFloat(data.amount);
            handlePaymentDecision({
              purpose: "donation",
              title: "Donation",
              description: "Club donation",
              amount,
              returnTo: { kind: "donation" },
              demoTitle: "Thank You",
              demoDescription: `Donation of ${currency(amount)} recorded (demo).`,
              doneTitle: "Thank you",
              doneDescription: `Donation of ${currency(amount)} recorded (demo).`,
            });
          }}
        />
      )}

      {step.kind === "done" && (
        <DoneStep
          title={step.title}
          description={step.description}
          onStartOver={goToSelect}
          onBackToOptions={goToSelect}
        />
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
