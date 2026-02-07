import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Divider,
} from "@heroui/react";
import { useState } from "react";
import type { NewMemberState } from "../types";
import BackButton from "@/components/back-button";
import { Icon } from "@iconify/react";

export function NewMemberApplicationStep(props: {
  initialValue: NewMemberState;
  membershipApplicationUrl?: string;
  contactAddress: { name: string; street: string; cityStateZip: string };
  membershipAmountDue: number;
  currency: (amount: number) => string;
  onBack: () => void;
  onSubmit: (data: NewMemberState) => void;
}) {
  const {
    initialValue,
    membershipApplicationUrl,
    contactAddress,
    membershipAmountDue,
    currency,
    onBack,
    onSubmit,
  } = props;
  const [value, setValue] = useState<NewMemberState>(initialValue);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const hasApplicationUrl = Boolean(membershipApplicationUrl);

  async function handleSubmit() {
    if (submitting) return;

    const nextErrors: Record<string, string> = {};
    if (!hasApplicationUrl) {
      nextErrors.newApplicationUrl =
        "Application PDF is required before continuing";
    }
    if (!value.acknowledged)
      nextErrors.newAcknowledged =
        "Please confirm you will mail in the application";

    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      onSubmit({
        acknowledged: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-4xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 2: Application</h2>
        <BackButton onPress={onBack} />
      </CardHeader>
      <Divider />
      <CardBody className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-base font-semibold">New Member Application</h3>
          <p className="text-sm text-default-600">
            Thank you for your interest in joining the club. New member
            applications are accepted by mail only.
          </p>
        </div>

        <div className="rounded-medium border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Icon
              icon="lucide:alert-triangle"
              width={20}
              height={20}
              className="text-warning mt-0.5 shrink-0"
            />
            <div>
              <p className="font-semibold text-foreground">
                Mailing the application is mandatory.
              </p>
              <p className="text-sm text-foreground-600 mt-1">
                We cannot process new member requests without a completed paper
                application mailed to the club.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Step 1: Download the application</h4>
          <p className="text-sm text-default-600">
            Fill out the PDF application and include any required signatures.
          </p>
          <Button
            as={hasApplicationUrl ? "a" : "button"}
            href={hasApplicationUrl ? membershipApplicationUrl : undefined}
            target={hasApplicationUrl ? "_blank" : undefined}
            rel={hasApplicationUrl ? "noreferrer" : undefined}
            color="primary"
            variant="flat"
            isDisabled={!hasApplicationUrl}
            startContent={
              <Icon icon="lucide:file-text" width={16} height={16} />
            }
          >
            {hasApplicationUrl ? "Download Application PDF" : "PDF unavailable"}
          </Button>
          {!hasApplicationUrl ? (
            <p className="text-xs text-warning">
              The application PDF has not been configured yet. Please check back
              soon.
            </p>
          ) : null}
          {localErrors.newApplicationUrl ? (
            <p className="text-xs text-danger">
              {localErrors.newApplicationUrl}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Step 2: Mail the application</h4>
          <p className="text-sm text-default-600">
            Mail your completed application to the same address used for check
            payments:
          </p>
          <div className="rounded-medium border border-content3 bg-content2 px-4 py-3 text-sm">
            <div className="font-semibold text-foreground">
              {contactAddress.name}
            </div>
            <div className="text-foreground-600">{contactAddress.street}</div>
            <div className="text-foreground-600">
              {contactAddress.cityStateZip}
            </div>
          </div>
          <p className="text-xs text-default-500">
            Applications are not accepted by email or in-person drop-off.
          </p>
        </div>

        <div className="space-y-2">
          <Checkbox
            isSelected={value.acknowledged}
            onValueChange={(v) => setValue((s) => ({ ...s, acknowledged: v }))}
            className="items-start max-w-full"
            classNames={{ label: "whitespace-normal" }}
          >
            I understand I must mail the completed application before my new
            member request can be reviewed.
          </Checkbox>
          {localErrors.newAcknowledged ? (
            <div className="text-danger text-sm">
              {localErrors.newAcknowledged}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-divider pt-2 font-bold">
          <span>Amount due</span>
          <span>{currency(membershipAmountDue)}</span>
        </div>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button
          color="primary"
          onPress={handleSubmit}
          isLoading={submitting}
          isDisabled={!hasApplicationUrl}
        >
          Continue to Payment
        </Button>
      </CardFooter>
    </Card>
  );
}
