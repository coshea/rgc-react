import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  addToast,
} from "@heroui/react";
import { useState } from "react";
import BackButton from "@/components/back-button";
import { siteConfig } from "@/config/site";
import {
  PayPalButtons,
  PayPalScriptProvider,
  type PayPalButtonsComponentProps,
} from "@paypal/react-paypal-js";

export function PayPalStep(props: {
  paypalEnabled: boolean;
  showPayPalSandboxNotice: boolean;
  paypalClientId: string;
  paypalCurrency: string;
  title: string;
  description: string;
  amount: number;
  currency: (amount: number) => string;
  createOrder: PayPalButtonsComponentProps["createOrder"];
  onApprove: PayPalButtonsComponentProps["onApprove"];
  onError: PayPalButtonsComponentProps["onError"];
  onBack: () => void;
  onCheckSelected?: () => void;
}) {
  const {
    paypalEnabled,
    showPayPalSandboxNotice,
    paypalClientId,
    paypalCurrency,
    title,
    description,
    amount,
    currency,
    createOrder,
    onApprove,
    onError,
    onBack,
    onCheckSelected,
  } = props;

  const [showCheckConfirm, setShowCheckConfirm] = useState(false);

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 3: Payment</h2>
        <BackButton onPress={onBack} />
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4 overflow-visible">
        {paypalEnabled && showPayPalSandboxNotice && (
          <Alert color="warning">
            PayPal is running in SANDBOX mode. Payments are not live.
          </Alert>
        )}

        <div>
          <div className="text-sm text-default-600">{title}</div>
          <div className="text-base font-semibold">{description}</div>
        </div>

        <div>
          <div className="text-sm text-default-600">Amount</div>
          <div className="text-base font-semibold">{currency(amount)}</div>
        </div>

        {paypalEnabled ? (
          <div className="w-full">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-500">
              Pay online (PayPal or card)
            </div>
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
                createOrder={createOrder}
                onApprove={onApprove}
                onError={onError}
              />
            </PayPalScriptProvider>
          </div>
        ) : (
          <div className="text-sm text-default-600">
            PayPal is not configured (missing `VITE_PAYPAL_CLIENT_ID`).
          </div>
        )}

        {/* Pay by check option */}
        <div className="mt-6 rounded-md border border-default-200 bg-content1/50 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-default-500">
            Pay by check (mail)
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">Pay by check</div>
              <p className="mt-2 text-sm text-default-600 whitespace-pre-line">
                {`Please make your check payable to "${siteConfig.contactAddress.name}" and mail to:\n${siteConfig.contactAddress.name}\n${siteConfig.contactAddress.street}\n${siteConfig.contactAddress.cityStateZip}\n\nPlease include your full name and the membership year in the memo so we can match it to your account.`}
              </p>
            </div>
            <div className="shrink-0">
              <Button
                variant="bordered"
                onPress={() => {
                  setShowCheckConfirm(true);
                }}
              >
                I mailed my check
              </Button>
            </div>
          </div>
        </div>
      </CardBody>

      {showCheckConfirm ? (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 10000 }}
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCheckConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-background p-6 shadow-large">
            <h3 className="text-lg font-semibold">Confirm check payment</h3>
            <p className="mt-2 text-sm text-default-600">
              Please confirm you’ve mailed your check to{" "}
              {siteConfig.contactAddress.name}. We’ll mark your membership as
              pending until it’s received.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="flat" onPress={() => setShowCheckConfirm(false)}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={() => {
                  setShowCheckConfirm(false);
                  if (typeof onCheckSelected === "function") {
                    onCheckSelected();
                  } else {
                    addToast({
                      title: "Mail a check",
                      description: `Please mail a check payable to ${siteConfig.contactAddress.name} to ${siteConfig.contactAddress.street}, ${siteConfig.contactAddress.cityStateZip} and include your name and membership year in the memo.`,
                      color: "success",
                    });
                  }
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
