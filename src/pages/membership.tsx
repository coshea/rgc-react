import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Divider,
  Chip,
  Spacer,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { addToast } from "@heroui/react";
import {
  MEMBERSHIP_FEE,
  HANDICAP_FEE,
  formatUSD,
  computeFeeBreakdown,
} from "@/config/membership-pricing";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import { subscribeMembershipSettings } from "@/api/membership";
import type { MembershipSettings } from "@/types/membershipSettings";
import MembershipAdminModal from "@/components/membership-admin-modal";

interface NewMemberFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  ghin: string;
}

export default function MembershipPage() {
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [mode, setMode] = useState<"new" | "renew" | "donate" | "handicap">(
    "new"
  );
  const [donation, setDonation] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewMemberFormState>({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
    ghin: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Subscribe to membership settings
  useEffect(() => {
    const unsubscribe = subscribeMembershipSettings((newSettings) => {
      setSettings(newSettings);
      setLoadingSettings(false);
    });
    return () => unsubscribe();
  }, []);

  // fees now sourced from membership-pricing config

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === "new") {
      if (!form.name.trim()) next.name = "Name required";
      if (!form.email.trim()) next.email = "Email required";
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
        next.email = "Invalid email";
      if (!form.phone.trim()) next.phone = "Phone required";
      if (!form.address.trim()) next.address = "Address required";
    }
    if (mode === "donate" && !donation.trim()) {
      next.donation = "Enter an amount";
    }
    if (mode === "donate" && donation.trim()) {
      const amt = parseFloat(donation);
      if (isNaN(amt) || amt <= 0) next.donation = "Amount must be > 0";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const currency = formatUSD;

  // Use dynamic pricing from settings, fallback to config defaults
  const fullMembershipPrice = settings?.fullMembershipPrice ?? MEMBERSHIP_FEE;
  const socialMembershipPrice = settings?.socialMembershipPrice ?? HANDICAP_FEE;

  function getSubmitLabel() {
    const donationValue = donation.trim();
    if (mode === "new") {
      // No donation input for new members yet; keep label simple
      return `Apply & Pay ${currency(fullMembershipPrice)}`;
    }
    if (mode === "renew") {
      const breakdown = computeFeeBreakdown(
        fullMembershipPrice,
        donationValue,
        "Membership",
        "membership"
      );
      return breakdown.donation > 0
        ? `Renew ${currency(breakdown.total)}`
        : `Renew ${currency(fullMembershipPrice)}`;
    }
    if (mode === "handicap") {
      const breakdown = computeFeeBreakdown(
        socialMembershipPrice,
        donationValue,
        "Handicap",
        "handicap"
      );
      return breakdown.donation > 0
        ? `Handicap ${currency(breakdown.total)}`
        : `Handicap ${currency(socialMembershipPrice)}`;
    }
    // donate only
    const breakdown = computeFeeBreakdown(
      0,
      donationValue,
      "Donation",
      "donationBase"
    );
    return breakdown.donation > 0
      ? `Donate ${currency(breakdown.donation)}`
      : "Donate";
  }

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Placeholder: integrate with payment backend / stripe / firestore as needed
      // We just simulate a short delay
      await new Promise((res) => setTimeout(res, 700));
      if (mode === "new") {
        addToast({
          title: "Application Submitted",
          description:
            "Thank you! We'll review your membership and follow up soon.",
          color: "success",
        });
      } else if (mode === "renew") {
        addToast({
          title: "Membership Renewed",
          description: `Your $${fullMembershipPrice} renewal was recorded (simulation).`,
          color: "success",
        });
      } else if (mode === "handicap") {
        addToast({
          title: "Handicap Purchased",
          description: `Your ${currency(socialMembershipPrice)} handicap purchase was recorded (simulation).`,
          color: "success",
        });
      } else {
        addToast({
          title: "Donation Received",
          description: `Thank you for donating ${currency(parseFloat(donation))}! (simulation)`,
          color: "success",
        });
      }
      // reset donation field
      if (mode === "donate" || mode === "renew" || mode === "handicap") {
        setDonation("");
      }
    } catch (e) {
      console.error(e);
      addToast({
        title: "Error",
        description: "Could not process request",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16">
      <header className="w-full max-w-2xl text-center">
        <h2 className="text-primary text-sm font-medium tracking-wide">
          Membership
        </h2>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          Choose the option that fits.
        </h1>
        <Spacer y={4} />
        <p className="text-default-500 text-base">
          New members can apply with a short form. Existing members can renew
          quickly. Anyone can optionally add a donation.
        </p>
        {/* Admin settings button - only visible to admins */}
        {isAdmin ? (
          <div className="mt-6 flex justify-center">
            <Button
              color="primary"
              variant="flat"
              size="sm"
              onPress={() => setShowAdminModal(true)}
              startContent={
                <Icon icon="lucide:settings" width={16} height={16} />
              }
            >
              Settings
            </Button>
          </div>
        ) : null}
      </header>

      <MembershipAdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />

      <Spacer y={10} />

      {/* Registration Closed Message */}
      {!loadingSettings && settings && !settings.registrationOpen && (
        <Card className="w-full max-w-3xl border-2 border-warning bg-content1/70 backdrop-blur">
          <CardBody className="p-6">
            <div className="flex items-start gap-4">
              <Icon
                icon="lucide:info"
                width={24}
                height={24}
                className="text-warning mt-1 shrink-0"
              />
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Registration Closed
                </h3>
                <p className="text-foreground-600 whitespace-pre-line">
                  {settings.closedMessage ||
                    "Membership registration is currently closed. Please check back later."}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Registration Form - only show if registration is open OR user is admin */}
      {!loadingSettings && (settings?.registrationOpen || isAdmin) && (
        <div className="space-y-6">
          <Card shadow="sm">
            <CardHeader className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Choose what you need</h2>
              <p className="text-sm text-default-600">
                Existing members can renew in seconds. New members can apply
                with a short form.
              </p>
            </CardHeader>
            <Divider />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card
                  isPressable
                  onPress={() => setMode("renew")}
                  role="button"
                  aria-label="Select Renew Membership"
                  className={
                    mode === "renew"
                      ? "border-2 border-primary bg-content2"
                      : "border border-default-200 hover:bg-content2"
                  }
                >
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:refresh-ccw" className="w-4 h-4" />
                        <h3 className="font-semibold">
                          Renew ({currency(fullMembershipPrice)})
                        </h3>
                      </div>
                      <p className="text-xs text-default-600">
                        For returning members ({new Date().getFullYear()}{" "}
                        season)
                      </p>
                    </div>
                    <Chip size="sm" variant="flat" color="primary">
                      Popular
                    </Chip>
                  </CardHeader>
                  <CardBody className="pt-0 text-sm text-default-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>Pay membership dues</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>Optional donation</span>
                    </div>
                  </CardBody>
                </Card>

                <Card
                  isPressable
                  onPress={() => setMode("new")}
                  role="button"
                  aria-label="Select New Member"
                  className={
                    mode === "new"
                      ? "border-2 border-primary bg-content2"
                      : "border border-default-200 hover:bg-content2"
                  }
                >
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:user-plus" className="w-4 h-4" />
                        <h3 className="font-semibold">New Member</h3>
                      </div>
                      <p className="text-xs text-default-600">
                        Apply first, then pay {currency(fullMembershipPrice)}
                      </p>
                    </div>
                    <Chip size="sm" variant="flat" color="warning">
                      Apply
                    </Chip>
                  </CardHeader>
                  <CardBody className="pt-0 text-sm text-default-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>Short application form</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>We’ll follow up after review</span>
                    </div>
                  </CardBody>
                </Card>

                <Card
                  isPressable
                  onPress={() => setMode("handicap")}
                  role="button"
                  aria-label="Select Handicap Only"
                  className={
                    mode === "handicap"
                      ? "border-2 border-primary bg-content2"
                      : "border border-default-200 hover:bg-content2"
                  }
                >
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:golf" className="w-4 h-4" />
                        <h3 className="font-semibold">
                          Handicap Only ({currency(socialMembershipPrice)})
                        </h3>
                      </div>
                      <p className="text-xs text-default-600">
                        USGA handicap index through the club
                      </p>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0 text-sm text-default-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>Handicap purchase/renewal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>Optional donation</span>
                    </div>
                  </CardBody>
                </Card>

                <Card
                  isPressable
                  onPress={() => setMode("donate")}
                  role="button"
                  aria-label="Select Donation Only"
                  className={
                    mode === "donate"
                      ? "border-2 border-primary bg-content2"
                      : "border border-default-200 hover:bg-content2"
                  }
                >
                  <CardHeader className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:hand-heart" className="w-4 h-4" />
                        <h3 className="font-semibold">Donation Only</h3>
                      </div>
                      <p className="text-xs text-default-600">
                        Support tournaments and member experience
                      </p>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-0 text-sm text-default-600 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:check" className="w-4 h-4" />
                      <span>Any amount</span>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {mode === "new"
                  ? "New member application"
                  : mode === "renew"
                    ? "Renew membership"
                    : mode === "handicap"
                      ? "Handicap index"
                      : "Make a donation"}
              </h2>
              <Chip size="sm" variant="flat" color="default">
                Demo payments
              </Chip>
            </CardHeader>
            <Divider />
            <CardBody className="space-y-6">
              {mode === "new" && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      label="Full Name"
                      value={form.name}
                      isInvalid={!!errors.name}
                      errorMessage={errors.name}
                      onValueChange={(v) => setForm((f) => ({ ...f, name: v }))}
                      variant="bordered"
                      required
                    />
                    <Input
                      label="Email"
                      value={form.email}
                      isInvalid={!!errors.email}
                      errorMessage={errors.email}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, email: v }))
                      }
                      variant="bordered"
                      type="email"
                      required
                    />
                    <Input
                      label="Phone"
                      value={form.phone}
                      isInvalid={!!errors.phone}
                      errorMessage={errors.phone}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, phone: v }))
                      }
                      variant="bordered"
                      placeholder="(xxx) xxx-xxxx"
                      required
                    />
                    <Input
                      label="Address"
                      value={form.address}
                      isInvalid={!!errors.address}
                      errorMessage={errors.address}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, address: v }))
                      }
                      variant="bordered"
                      required
                    />
                    <Input
                      label="GHIN Number (optional)"
                      value={form.ghin}
                      onValueChange={(v) => setForm((f) => ({ ...f, ghin: v }))}
                      variant="bordered"
                      placeholder="If you have one from another club"
                      className="md:col-span-2"
                    />
                  </div>
                  <Chip size="sm" variant="flat" color="warning">
                    Payment processing not yet live – submission is for demo
                    only.
                  </Chip>
                </div>
              )}

              {mode === "renew" && (
                <div className="space-y-4">
                  <p className="text-sm text-default-600">
                    You are renewing for the {new Date().getFullYear()} season.
                    The renewal fee is{" "}
                    <strong>{currency(MEMBERSHIP_FEE)}</strong>. Add an optional
                    donation below if you'd like to further support the club.
                  </p>
                  <Input
                    label="Optional Donation"
                    startContent={
                      <span className="text-default-400 text-sm">$</span>
                    }
                    value={donation}
                    onValueChange={setDonation}
                    placeholder="0.00"
                    variant="bordered"
                    type="number"
                    min={0}
                  />
                </div>
              )}

              {mode === "handicap" && (
                <div className="space-y-4">
                  <p className="text-sm text-default-600">
                    Purchase or renew only a USGA handicap index through the
                    club for the current season. This does not include full club
                    membership benefits. Fee:{" "}
                    <strong>{currency(HANDICAP_FEE)}</strong>.
                  </p>
                  <Input
                    label="Optional Donation"
                    startContent={
                      <span className="text-default-400 text-sm">$</span>
                    }
                    value={donation}
                    onValueChange={setDonation}
                    placeholder="0.00"
                    variant="bordered"
                    type="number"
                    min={0}
                  />
                </div>
              )}

              {mode === "donate" && (
                <div className="space-y-4">
                  <p className="text-sm text-default-600">
                    Every contribution—large or small—helps us improve
                    tournaments, technology, and member experience.
                  </p>
                  <Input
                    label="Donation Amount"
                    startContent={
                      <span className="text-default-400 text-sm">$</span>
                    }
                    value={donation}
                    isInvalid={!!errors.donation}
                    errorMessage={errors.donation}
                    onValueChange={setDonation}
                    placeholder="50.00"
                    variant="bordered"
                    type="number"
                    min={0}
                    required
                  />
                </div>
              )}
            </CardBody>
            <Divider />
            <CardFooter className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="text-[11px] text-default-500 flex-1">
                  This page is a functional placeholder. Actual payment
                  integration (Stripe, etc.) can be added later.
                </div>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="flat"
                    onPress={() => {
                      setErrors({});
                      setForm({
                        name: "",
                        email: user?.email || "",
                        phone: "",
                        address: "",
                        ghin: "",
                      });
                      setDonation("");
                    }}
                    isDisabled={submitting}
                  >
                    Reset
                  </Button>
                  <div className="flex flex-col items-stretch">
                    <Button
                      color="primary"
                      onPress={handleSubmit}
                      isLoading={submitting}
                      className="truncate max-w-[250px] sm:max-w-none"
                    >
                      {getSubmitLabel()}
                    </Button>
                    {(() => {
                      const donationValue = donation.trim();
                      if (!donationValue) return null;
                      const parsed = parseFloat(donationValue);
                      if (!Number.isFinite(parsed) || parsed <= 0) return null;

                      if (mode === "renew") {
                        const breakdown = computeFeeBreakdown(
                          fullMembershipPrice,
                          donationValue,
                          "Membership",
                          "membership"
                        );
                        if (breakdown.donation <= 0) return null;
                        return (
                          <div className="mt-1 text-[11px] text-default-500">
                            Includes Membership {currency(fullMembershipPrice)}{" "}
                            + Donation {currency(breakdown.donation)}
                          </div>
                        );
                      }

                      if (mode === "handicap") {
                        const breakdown = computeFeeBreakdown(
                          socialMembershipPrice,
                          donationValue,
                          "Handicap",
                          "handicap"
                        );
                        if (breakdown.donation <= 0) return null;
                        return (
                          <div className="mt-1 text-[11px] text-default-500">
                            Includes Handicap {currency(socialMembershipPrice)}{" "}
                            + Donation {currency(breakdown.donation)}
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
