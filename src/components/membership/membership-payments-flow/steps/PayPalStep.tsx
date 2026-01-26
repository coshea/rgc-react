import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  addToast,
} from "@heroui/react";
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
                  if (typeof onCheckSelected === "function") {
                    onCheckSelected();
                  } else {
                    // Fallback: show a toast with instructions
                    addToast({
                      title: "Mail a check",
                      description: `Please mail a check payable to ${siteConfig.contactAddress.name} to ${siteConfig.contactAddress.street}, ${siteConfig.contactAddress.cityStateZip} and include your name and membership year in the memo.`,
                      color: "success",
                    });
                  }
                }}
              >
                I mailed my check
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
