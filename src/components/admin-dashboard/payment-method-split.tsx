import { Icon } from "@iconify/react";

interface PaymentMethodSplitProps {
  check: number;
  paypal: number;
}

function share(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Check vs PayPal counts with each method's share of the payments. */
export function PaymentMethodSplit({ check, paypal }: PaymentMethodSplitProps) {
  const total = check + paypal;
  const methods = [
    { label: "Check", icon: "lucide:mail", count: check },
    { label: "PayPal", icon: "lucide:laptop-minimal", count: paypal },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3" aria-label="Payments by method">
      {methods.map((method) => (
        <li key={method.label} className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1">
            <Icon icon={method.icon} className="w-3 h-3" />
            {method.label}
          </span>
          <span className="text-base font-semibold text-foreground tabular-nums">
            {method.count}
            <span className="ml-1 text-xs font-normal text-muted">
              {share(method.count, total)}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
