// Centralized membership & related fee constants.
// If future pricing tiers, discounts, or seasonal adjustments are added,
// extend this module rather than scattering literals.

export const MEMBERSHIP_FEE = 85; // USD annual full membership
export const HANDICAP_FEE = 50; // USD handicap (GHIN) only service

export function formatUSD(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export interface FeePart {
  key: string; // stable identifier (e.g. 'membership', 'handicap', 'donation')
  label: string; // human readable label
  amount: number; // raw numeric value
  formatted: string; // preformatted currency string
}

export interface FeeBreakdown {
  base: number;
  donation: number;
  total: number;
  label: string; // existing combined label
  parts: FeePart[]; // ordered semantic parts
}

/**
 * Computes a fee breakdown with semantic parts for structured UI.
 * @param base Base (non-donation) amount.
 * @param donationRaw Donation as string input.
 * @param baseLabel Optional label for the base component (default: 'Membership').
 * @param baseKey Optional key (default: 'base').
 */
export function computeFeeBreakdown(
  base: number,
  donationRaw: string,
  baseLabel: string = "Membership",
  baseKey: string = "base"
): FeeBreakdown {
  const donation = parseFloat(donationRaw || "0") || 0;
  const total = base + donation;
  const parts: FeePart[] = [
    {
      key: baseKey,
      label: baseLabel,
      amount: base,
      formatted: formatUSD(base),
    },
  ];
  if (donation > 0) {
    parts.push({
      key: "donation",
      label: "Donation",
      amount: donation,
      formatted: formatUSD(donation),
    });
  }
  return {
    base,
    donation,
    total,
    label:
      donation > 0
        ? `${formatUSD(total)} (Includes ${formatUSD(base)} + ${formatUSD(donation)} donation)`
        : formatUSD(base),
    parts,
  };
}
