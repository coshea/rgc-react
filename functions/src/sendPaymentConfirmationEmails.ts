/**
 * Email template builders and Resend API helper for payment confirmation
 * emails (membership and donations).
 *
 * Three template types are supported:
 *  - Full membership (PayPal/Venmo or check)
 *  - Handicap membership (PayPal/Venmo or check)
 *  - Donation-only (PayPal/Venmo or check)
 *
 * PayPal/Venmo payments include the captured amount. Check payments
 * acknowledge receipt of the request without quoting a dollar amount.
 */

import type { MembershipType } from "./types";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FROM_EMAIL = "Ridgefield Golf Club <noreply@ridgefieldgolfclub.org>";
const BASE_URL = "https://ridgefieldgolfclub.org";
const CONTACT_EMAIL = "RidgefieldCTGolfClub@gmail.com";

// ── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = "paypal" | "check";

export interface MembershipConfirmationParams {
  /** Display name / full name to greet the member. */
  name: string;
  membershipType: MembershipType;
  paymentMethod: PaymentMethod;
  /** Captured amount (dollars). Required for paypal; omit for check. */
  amount?: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency?: string;
  year: number;
}

export interface DonationConfirmationParams {
  name: string;
  paymentMethod: PaymentMethod;
  amount?: number;
  currency?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal HTML entity escaping for dynamic values rendered in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a dollar amount as "$85.00". Falls back to empty string. */
function formatAmount(amount: number | undefined, currency = "USD"): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  if (currency.toUpperCase() === "USD") {
    return `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

// ── HTML Builders ─────────────────────────────────────────────────────────────

/** Shared HTML header used by all payment confirmation emails. */
function buildEmailHeader(headline: string, subline: string): string {
  return `
          <!-- HEADER -->
          <tr>
            <td bgcolor="#1a5c2e" align="center" style="background-color:#1a5c2e;border-radius:13px 13px 0 0;padding:32px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" align="center" style="background-color:#ffffff;border-radius:8px;padding:8px 20px;">
                    <img src="https://www.ridgefieldgolfclub.org/rgc_logo.png" width="160" height="48" border="0" alt="Ridgefield Golf Club" style="display:block;width:160px;height:auto;border:0;">
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:26px;color:#ffffff;font-family:${FONT};font-weight:700;line-height:1.3;">${headline}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#bbf7d0;font-family:${FONT};line-height:1.5;">${subline}</p>
            </td>
          </tr>`;
}

/** Shared HTML footer used by all payment confirmation emails. */
function buildEmailFooter(): string {
  return `
          <!-- DIVIDER -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #e4e4e7;font-size:1px;line-height:1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- CONTACT -->
          <tr>
            <td style="padding:20px 40px 0;">
              <p style="margin:0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Questions? Email us at <a href="mailto:${CONTACT_EMAIL}" style="color:#006fee;text-decoration:underline;">${CONTACT_EMAIL}</a></p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:16px 40px 28px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;font-family:${FONT};line-height:1.6;">Ridgefield Golf Club &bull; PO Box 24, Ridgefield, CT 06877</p>
            </td>
          </tr>`;
}

/** Three quick-link rows for tournaments, directory, and profile. */
function buildMemberQuickLinks(): string {
  const links: Array<{
    emoji: string;
    label: string;
    desc: string;
    href: string;
  }> = [
    {
      emoji: "&#9971;",
      label: "Tournaments",
      desc: "Browse upcoming tournaments and register your team.",
      href: `${BASE_URL}/tournaments`,
    },
    {
      emoji: "&#128101;",
      label: "Member Directory",
      desc: "Find and connect with fellow club members.",
      href: `${BASE_URL}/membership/member-directory`,
    },
    {
      emoji: "&#128100;",
      label: "Your Profile",
      desc: "View your membership history and manage your account details.",
      href: `${BASE_URL}/profile`,
    },
  ];

  const rows = links
    .map(
      (l) => `
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e4e4e7;">
                    <a href="${l.href}" style="text-decoration:none;display:block;">
                      <p style="margin:0;font-size:14px;color:#11181c;font-family:${FONT};font-weight:600;line-height:1.5;">${l.emoji}&nbsp; <span style="color:#006fee;">${l.label}</span></p>
                      <p style="margin:3px 0 0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.5;">${l.desc}</p>
                    </a>
                  </td>
                </tr>`,
    )
    .join("\n");

  return `
          <!-- QUICK LINKS -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 4px;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Explore the Club</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td>
          </tr>`;
}

/** Renders the payment confirmation box (amount or check receipt notice). */
function buildPaymentBox(
  method: PaymentMethod,
  amount: number | undefined,
  currency: string | undefined,
): string {
  const amountStr = formatAmount(amount, currency);
  const paymentLine =
    method === "check"
      ? `<p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#9989;&nbsp; <strong>Payment method:</strong> Check &mdash; we have received your check payment request and will confirm once it has been processed.</p>`
      : `<p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#9989;&nbsp; <strong>Amount paid:</strong> <strong>${esc(amountStr)}</strong> via PayPal / Venmo</p>`;

  return `
          <!-- PAYMENT DETAILS -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:16px 20px;">
                    ${paymentLine}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function buildFullMembershipEmailHtml(
  p: MembershipConfirmationParams,
): string {
  const { name, paymentMethod, amount, currency, year } = p;

  const isCheck = paymentMethod === "check";
  const headline = "Membership Confirmed!";
  const subline = isCheck
    ? `Your ${year} membership request has been received.`
    : `Your ${year} full membership is now active.`;

  const greeting = isCheck
    ? `Thank you, <strong>${esc(name)}</strong>! We&#39;ve received your <strong>${year} Full Membership</strong> check payment request. Your membership will be confirmed once we receive and process your check.`
    : `Thank you, <strong>${esc(name)}</strong>! Your payment for <strong>${year} Full Membership</strong> has been successfully processed. Welcome (or welcome back) to the Ridgefield Golf Club!`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${year} Full Membership Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">
          ${buildEmailHeader(headline, subline)}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">${greeting}</p>
            </td>
          </tr>
          ${buildPaymentBox(paymentMethod, amount, currency)}
          ${buildMemberQuickLinks()}
          ${buildEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildHandicapMembershipEmailHtml(
  p: MembershipConfirmationParams,
): string {
  const { name, paymentMethod, amount, currency, year } = p;

  const isCheck = paymentMethod === "check";
  const headline = "Membership Confirmed!";
  const subline = isCheck
    ? `Your ${year} handicap membership request has been received.`
    : `Your ${year} handicap membership is now active.`;

  const greeting = isCheck
    ? `Thank you, <strong>${esc(name)}</strong>! We&#39;ve received your <strong>${year} Handicap Membership</strong> check payment request. Your membership will be confirmed once we receive and process your check.`
    : `Thank you, <strong>${esc(name)}</strong>! Your payment for <strong>${year} Handicap Membership</strong> has been successfully processed.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${year} Handicap Membership Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">
          ${buildEmailHeader(headline, subline)}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">${greeting}</p>
            </td>
          </tr>
          ${buildPaymentBox(paymentMethod, amount, currency)}

          <!-- HANDICAP NOTICE -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fefce8;border-radius:10px;border:1px solid #fde047;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#713f12;font-family:${FONT};font-weight:700;line-height:1.5;">&#9888; Handicap Membership Note</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#713f12;font-family:${FONT};line-height:1.6;">Handicap membership provides access to the GHIN handicap system but does <strong>not</strong> include eligibility to participate in club tournaments. To participate in tournaments, please upgrade to a Full Membership.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${buildMemberQuickLinks()}
          ${buildEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildDonationEmailHtml(p: DonationConfirmationParams): string {
  const { name, paymentMethod, amount, currency } = p;

  const isCheck = paymentMethod === "check";
  const amountStr = formatAmount(amount, currency);
  const headline = "&#10084; Thank You for Your Donation!";
  const subline = "Your generosity supports the Ridgefield Golf Club.";

  const greeting = isCheck
    ? `Thank you, <strong>${esc(name)}</strong>! We&#39;ve received your donation check request. Your contribution will be recorded once we receive and process your check.`
    : `Thank you, <strong>${esc(name)}</strong>! Your generous donation of <strong>${esc(amountStr)}</strong> to the Ridgefield Golf Club has been received. We truly appreciate your support!`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Thank You for Your Donation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">
          ${buildEmailHeader(headline, subline)}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">${greeting}</p>
              <p style="margin:12px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">Your donation helps us maintain the club, fund tournaments, and grow the golfing community in Ridgefield.</p>
            </td>
          </tr>
          ${isCheck ? "" : buildPaymentBox(paymentMethod, amount, currency)}
          ${buildEmailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Resend API ────────────────────────────────────────────────────────────────

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

async function callResendApi(
  apiKey: string,
  payload: ResendPayload,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();

    let errorCode: string | undefined;
    let errorId: string | undefined;

    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        const parsedRecord = parsed as Record<string, unknown>;
        if (typeof parsedRecord.code === "string") {
          errorCode = parsedRecord.code;
        }
        if (typeof parsedRecord.id === "string") {
          errorId = parsedRecord.id;
        }
      }
    } catch {
      // Ignore parse failures; fall back to status-only error message.
    }

    const details = [
      errorCode ? `code=${errorCode}` : undefined,
      errorId ? `id=${errorId}` : undefined,
    ]
      .filter((d): d is string => Boolean(d))
      .join(", ");

    throw new Error(
      details
        ? `Resend API error ${response.status} (${details})`
        : `Resend API error ${response.status}`,
    );
  }
}

// ── Public send functions ────────────────────────────────────────────────────

/**
 * Send a membership payment confirmation email.
 * Chooses the correct template based on `membershipType`.
 */
export async function sendMembershipConfirmationEmail(
  apiKey: string,
  to: string,
  params: MembershipConfirmationParams,
): Promise<void> {
  const { membershipType, year, paymentMethod } = params;

  const isCheck = paymentMethod === "check";
  let subject: string;
  let html: string;

  if (membershipType === "full") {
    subject = isCheck
      ? `Ridgefield Golf Club – ${year} Membership Request Received`
      : `Welcome to Ridgefield Golf Club – ${year} Membership Confirmed`;
    html = buildFullMembershipEmailHtml(params);
  } else {
    subject = isCheck
      ? `Ridgefield Golf Club – ${year} Handicap Membership Request Received`
      : `Ridgefield Golf Club – ${year} Handicap Membership Confirmed`;
    html = buildHandicapMembershipEmailHtml(params);
  }

  await callResendApi(apiKey, { from: FROM_EMAIL, to: [to], subject, html });
}

/**
 * Send a donation payment confirmation email.
 */
export async function sendDonationConfirmationEmail(
  apiKey: string,
  to: string,
  params: DonationConfirmationParams,
): Promise<void> {
  const html = buildDonationEmailHtml(params);
  const subject =
    params.paymentMethod === "check"
      ? "Ridgefield Golf Club – Donation Request Received"
      : "Thank You for Your Donation to Ridgefield Golf Club";

  await callResendApi(apiKey, { from: FROM_EMAIL, to: [to], subject, html });
}
