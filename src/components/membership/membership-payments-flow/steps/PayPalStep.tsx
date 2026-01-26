import { Alert, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import BackButton from "@/components/back-button";
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
      </CardBody>
    </Card>
  );
}
