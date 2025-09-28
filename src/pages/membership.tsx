import { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  RadioGroup,
  Radio,
  Divider,
  Chip,
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

interface NewMemberFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  ghin: string;
}

export default function MembershipPage() {
  const { user } = useAuth();
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

  function getSubmitLabel() {
    const donationValue = donation.trim();
    if (mode === "new") {
      // No donation input for new members yet; keep label simple
      return `Apply & Pay ${currency(MEMBERSHIP_FEE)}`;
    }
    if (mode === "renew") {
      const breakdown = computeFeeBreakdown(
        MEMBERSHIP_FEE,
        donationValue,
        "Membership",
        "membership"
      );
      return breakdown.donation > 0
        ? `Renew ${currency(breakdown.total)}`
        : `Renew ${currency(MEMBERSHIP_FEE)}`;
    }
    if (mode === "handicap") {
      const breakdown = computeFeeBreakdown(
        HANDICAP_FEE,
        donationValue,
        "Handicap",
        "handicap"
      );
      return breakdown.donation > 0
        ? `Handicap ${currency(breakdown.total)}`
        : `Handicap ${currency(HANDICAP_FEE)}`;
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
          description: `Your $${MEMBERSHIP_FEE} renewal was recorded (simulation).`,
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
      if (mode === "donate") setDonation("");
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
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold">Membership</h1>
        <p className="text-default-600 max-w-2xl text-sm leading-relaxed">
          Welcome to the Ridgefield Golf Club! We are thrilled you're here. Our
          annual membership fee is <strong>{currency(MEMBERSHIP_FEE)}</strong>{" "}
          and helps fund tournaments, course enhancements, and member events.
          New members submit the short application below. Returning members can
          quickly renew. Anyone can optionally support the club with an
          additional donation.
        </p>
      </header>

      <Card shadow="sm">
        <CardHeader className="flex flex-col gap-2 pb-2">
          <h2 className="text-lg font-semibold">Select an Option</h2>
          <RadioGroup
            orientation="horizontal"
            value={mode}
            onValueChange={(v) => setMode(v as any)}
            aria-label="Choose membership action"
            className="flex flex-wrap gap-4"
          >
            <Radio value="new" description="Apply as a brand new member">
              New Member
            </Radio>
            <Radio
              value="renew"
              description={`Renew existing membership (${currency(MEMBERSHIP_FEE)})`}
            >
              Renew ({currency(MEMBERSHIP_FEE)})
            </Radio>
            <Radio
              value="handicap"
              description={`Purchase handicap index only (${currency(HANDICAP_FEE)})`}
            >
              Handicap Only ({currency(HANDICAP_FEE)})
            </Radio>
            <Radio
              value="donate"
              description="Support the club with any amount"
            >
              Donation Only
            </Radio>
          </RadioGroup>
        </CardHeader>
        <Divider />
        <CardBody className="space-y-6">
          {mode === "new" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Icon icon="lucide:user-plus" className="w-4 h-4" /> New Member
                Application
              </h3>
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
                  onValueChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  variant="bordered"
                  type="email"
                  required
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  isInvalid={!!errors.phone}
                  errorMessage={errors.phone}
                  onValueChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  variant="bordered"
                  placeholder="(xxx) xxx-xxxx"
                  required
                />
                <Input
                  label="Address"
                  value={form.address}
                  isInvalid={!!errors.address}
                  errorMessage={errors.address}
                  onValueChange={(v) => setForm((f) => ({ ...f, address: v }))}
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
                Payment processing not yet live – submission is for demo only.
              </Chip>
            </div>
          )}

          {mode === "renew" && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Icon icon="lucide:refresh-ccw" className="w-4 h-4" /> Renew
                Membership
              </h3>
              <p className="text-sm text-default-600">
                You are renewing for the {new Date().getFullYear()} season. The
                renewal fee is <strong>{currency(MEMBERSHIP_FEE)}</strong>. Add
                an optional donation below if you'd like to further support the
                club.
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
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Icon icon="lucide:golf" className="w-4 h-4" /> Handicap Index
                Only
              </h3>
              <p className="text-sm text-default-600">
                Purchase or renew only a USGA handicap index through the club
                for the current season. This does not include full club
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
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Icon icon="lucide:hand-heart" className="w-4 h-4" /> Make a
                Donation
              </h3>
              <p className="text-sm text-default-600">
                Every contribution—large or small—helps us improve tournaments,
                technology, and member experience.
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
              This page is a functional placeholder. Actual payment integration
              (Stripe, etc.) can be added later.
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
                {/* Donation breakdown (kept out of button to avoid overflow) */}
                {(() => {
                  const donationValue = donation.trim();
                  const hasDonation =
                    !!donationValue &&
                    !isNaN(parseFloat(donationValue)) &&
                    parseFloat(donationValue) > 0;
                  if (!hasDonation) return null;
                  if (mode === "renew") {
                    return (
                      <div className="text-[10px] text-default-500 mt-1 text-right sm:text-left">
                        Includes Membership {currency(MEMBERSHIP_FEE)} +
                        Donation {currency(parseFloat(donationValue))}
                      </div>
                    );
                  }
                  if (mode === "handicap") {
                    return (
                      <div className="text-[10px] text-default-500 mt-1 text-right sm:text-left">
                        Includes Handicap {currency(HANDICAP_FEE)} + Donation{" "}
                        {currency(parseFloat(donationValue))}
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
  );
}
