import type { ResendBatchEmail } from "./resendBatch";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FROM_EMAIL = "Ridgefield Golf Club <noreply@ridgefieldgolfclub.org>";
const BASE_URL = "https://ridgefieldgolfclub.org";
const CONTACT_EMAIL = "RidgefieldCTGolfClub@gmail.com";
export const MANAGE_NOTIFICATIONS_URL = `${BASE_URL}/settings/notifications`;

export interface RegistrationOpeningAdminEmailParams {
  tournamentTitle: string;
  tournamentUrl: string;
  /** Href for the tournament links when it differs from the shown URL (UTM tags). */
  tournamentLinkUrl?: string;
  tournamentDate?: string;
  registrationCloses?: string;
  tournamentTee: string;
  tournamentTeeTimes: string;
  fieldSize?: string;
  /** Member variant: personal greeting instead of "Hello RGC Members". */
  recipientFirstName?: string;
  /** Member variant: adds a "why you got this" footer with this link. */
  manageNotificationsUrl?: string;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTeeBadgeStyle(tee: string): {
  backgroundColor: string;
  color: string;
} {
  const normalized = (tee || "Mixed").trim();
  switch (normalized) {
    case "White":
      return { backgroundColor: "#e5e7eb", color: "#52525b" };
    case "Blue":
      return { backgroundColor: "#dbeafe", color: "#1d4ed8" };
    case "Gold":
      return { backgroundColor: "#fef3c7", color: "#a16207" };
    case "Red":
      return { backgroundColor: "#fee2e2", color: "#dc2626" };
    case "Mixed":
    default:
      return { backgroundColor: "#ccfbf1", color: "#0f766e" };
  }
}

const DETAIL_LABEL_STYLE = `padding:7px 12px 7px 0;width:40%;vertical-align:top;font-size:14px;color:#71717a;font-family:${FONT};line-height:1.5;`;
const DETAIL_VALUE_STYLE = `padding:7px 0;vertical-align:top;font-size:14px;color:#11181c;font-family:${FONT};font-weight:600;line-height:1.5;`;

function buildDetailRow(label: string, value: string | undefined): string {
  if (!value) return "";

  let valueHtml = esc(value);
  if (label === "Tee") {
    const { backgroundColor, color } = getTeeBadgeStyle(value);
    valueHtml = `<span style="display:inline-block;background-color:${backgroundColor};color:${color};padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.6;">${esc(value)}</span>`;
  }

  return `<tr><td style="${DETAIL_LABEL_STYLE}">${esc(label)}</td><td style="${DETAIL_VALUE_STYLE}">${valueHtml}</td></tr>`;
}

function buildDetails(
  params: RegistrationOpeningAdminEmailParams,
): [label: string, value: string | undefined][] {
  return [
    ["Date", params.tournamentDate],
    ["Registration closes", params.registrationCloses],
    ["Tee", params.tournamentTee],
    ["Tee times", params.tournamentTeeTimes],
    ["Field size", params.fieldSize],
  ];
}

function buildGreeting(recipientFirstName: string | undefined): string {
  const name = recipientFirstName?.trim();
  return name ? `Hi ${name},` : "Hello RGC Members,";
}

function buildIntro(params: RegistrationOpeningAdminEmailParams): {
  html: string;
  text: string;
} {
  const { tournamentTitle, tournamentDate } = params;
  const when = tournamentDate ? `, which will be played on ${tournamentDate}` : "";
  return {
    html: `Registration is now open for <strong>${esc(tournamentTitle)}</strong>${esc(when)}. We hope you&#39;ll join us.`,
    text: `Registration is now open for ${tournamentTitle}${when}. We hope you'll join us.`,
  };
}

const EARLY_SIGNUP_COPY =
  "Please register early. It helps us plan the field and manage the waitlist if the event fills up.";

export function buildRegistrationOpeningAdminEmailHtml(
  params: RegistrationOpeningAdminEmailParams,
): string {
  const {
    tournamentTitle,
    tournamentUrl,
    tournamentLinkUrl = tournamentUrl,
    tournamentDate,
    registrationCloses,
    recipientFirstName,
    manageNotificationsUrl,
  } = params;

  const preheader = [
    tournamentDate ? `${tournamentDate}.` : "",
    registrationCloses ? `Registration closes ${registrationCloses}.` : "",
    "Reserve your spot today.",
  ]
    .filter(Boolean)
    .join(" ");
  const preferencesFooter = manageNotificationsUrl
    ? `<p style="margin:8px 0 0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">You&#39;re receiving this email because you&#39;re a current Ridgefield Golf Club member with tournament updates turned on. <a href="${esc(manageNotificationsUrl)}" style="color:#006fee;text-decoration:underline;">Manage email preferences</a></p>`
    : "";

  const detailsRows = buildDetails(params)
    .map(([label, value]) => buildDetailRow(label, value))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Registration Now Open: ${esc(tournamentTitle)}</title>
  <style>
    @media only screen and (max-width:600px) {
      .rgc-px { padding-left:20px !important; padding-right:20px !important; }
      .rgc-btn { display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f4f5;opacity:0;">${esc(preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">
          <tr>
            <td class="rgc-px" bgcolor="#1a5c2e" align="center" style="background-color:#1a5c2e;border-radius:13px 13px 0 0;padding:32px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" align="center" style="background-color:#ffffff;border-radius:8px;padding:8px 20px;">
                    <img src="https://www.ridgefieldgolfclub.org/rgc_logo.png" width="160" height="48" border="0" alt="Ridgefield Golf Club" style="display:block;width:160px;height:auto;border:0;">
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#bbf7d0;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Registration Now Open</p>
              <p style="margin:8px 0 0;font-size:26px;color:#ffffff;font-family:${FONT};font-weight:700;line-height:1.3;">${esc(tournamentTitle)}</p>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">${esc(buildGreeting(recipientFirstName))}</p>
              <p style="margin:12px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">${buildIntro(params).html}</p>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;border-radius:10px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:18px 20px 11px;">
                    <p style="margin:0 0 4px;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Tournament Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${detailsRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" style="padding:20px 40px 0;">
              <p style="margin:0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">${esc(EARLY_SIGNUP_COPY)}</p>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" align="center" style="padding:24px 40px 0;">
              <a class="rgc-btn" href="${esc(tournamentLinkUrl)}" target="_blank" style="display:inline-block;background-color:#006fee;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;">View Details &amp; Register</a>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" style="padding:24px 40px 0;">
              <p style="margin:0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">See you on the course,<br><strong style="color:#11181c;">Ridgefield Golf Club</strong></p>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #e4e4e7;font-size:1px;line-height:1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="rgc-px" style="padding:20px 40px 0;">
              <p style="margin:0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">If the button doesn&#39;t work, copy this link into your browser:<br><a href="${esc(tournamentLinkUrl)}" style="color:#006fee;text-decoration:underline;word-break:break-all;">${esc(tournamentUrl)}</a></p>
              <p style="margin:8px 0 0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Questions? Email us at <a href="mailto:${CONTACT_EMAIL}" style="color:#006fee;text-decoration:underline;">${CONTACT_EMAIL}</a>.</p>
              ${preferencesFooter}
            </td>
          </tr>
          <tr>
            <td class="rgc-px" align="center" style="padding:16px 40px 28px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;font-family:${FONT};line-height:1.6;">Ridgefield Golf Club &bull; PO Box 24, Ridgefield, CT 06877</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text alternative; improves deliverability and reads well in text-only clients. */
export function buildRegistrationOpeningEmailText(
  params: RegistrationOpeningAdminEmailParams,
): string {
  const {
    tournamentTitle,
    tournamentUrl,
    tournamentLinkUrl = tournamentUrl,
    recipientFirstName,
    manageNotificationsUrl,
  } = params;

  const details = buildDetails(params)
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  return [
    `REGISTRATION NOW OPEN: ${tournamentTitle}`,
    "",
    buildGreeting(recipientFirstName),
    "",
    buildIntro(params).text,
    "",
    "TOURNAMENT DETAILS",
    ...details,
    "",
    EARLY_SIGNUP_COPY,
    "",
    `View details and register: ${tournamentLinkUrl}`,
    "",
    "See you on the course,",
    "Ridgefield Golf Club",
    "",
    "---",
    `Questions? Email us at ${CONTACT_EMAIL}.`,
    ...(manageNotificationsUrl
      ? [
          "You're receiving this email because you're a current Ridgefield Golf Club member with tournament updates turned on.",
          `Manage email preferences: ${manageNotificationsUrl}`,
        ]
      : []),
    "Ridgefield Golf Club, PO Box 24, Ridgefield, CT 06877",
  ].join("\n");
}

function buildSubject(tournamentTitle: string): string {
  return `Registration Now Open: ${tournamentTitle}`;
}

async function callResendApi(
  apiKey: string,
  payload: ResendBatchEmail,
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
    throw new Error(`Resend API error ${response.status}`);
  }
}

export async function sendRegistrationOpeningAdminEmail(
  apiKey: string,
  recipients: string[],
  params: RegistrationOpeningAdminEmailParams,
): Promise<void> {
  if (recipients.length === 0) {
    return;
  }

  await callResendApi(apiKey, {
    from: FROM_EMAIL,
    to: recipients,
    subject: buildSubject(params.tournamentTitle),
    html: buildRegistrationOpeningAdminEmailHtml(params),
    text: buildRegistrationOpeningEmailText(params),
  });
}

export const UTM_CAMPAIGN = {
  REGISTRATION_OPENING: "registration_opening",
  REGISTRATION_OPENING_PREVIEW: "registration_opening_preview",
} as const;

/**
 * Adds UTM tags so GA4 attributes visits (and the `tournament_register` key
 * event) to the email. `utm_content` carries the tournament id.
 */
export function withUtm(
  url: string,
  campaign: string,
  content: string,
): string {
  const tagged = new URL(url);
  tagged.searchParams.set("utm_source", "resend");
  tagged.searchParams.set("utm_medium", "email");
  tagged.searchParams.set("utm_campaign", campaign);
  tagged.searchParams.set("utm_content", content);
  return tagged.toString();
}

export interface RegistrationOpeningMemberRecipient {
  email: string;
  firstName?: string;
}

/**
 * One member's copy of the registration-opening email, ready for the Resend
 * batch API. Same template as the admin email, personalised, with a
 * preferences footer, a List-Unsubscribe header and tags for Resend analytics.
 */
export function buildRegistrationOpeningMemberEmail(
  recipient: RegistrationOpeningMemberRecipient,
  tournamentId: string,
  params: RegistrationOpeningAdminEmailParams,
  campaign: string = UTM_CAMPAIGN.REGISTRATION_OPENING,
): ResendBatchEmail {
  const memberParams: RegistrationOpeningAdminEmailParams = {
    ...params,
    tournamentLinkUrl: withUtm(params.tournamentUrl, campaign, tournamentId),
    recipientFirstName: recipient.firstName,
    manageNotificationsUrl: MANAGE_NOTIFICATIONS_URL,
  };
  return {
    from: FROM_EMAIL,
    to: [recipient.email],
    subject: buildSubject(params.tournamentTitle),
    html: buildRegistrationOpeningAdminEmailHtml(memberParams),
    text: buildRegistrationOpeningEmailText(memberParams),
    headers: {
      "List-Unsubscribe": `<${MANAGE_NOTIFICATIONS_URL}>, <mailto:${CONTACT_EMAIL}?subject=Unsubscribe>`,
    },
    tags: [
      { name: "category", value: "registration_opening" },
      {
        name: "tournament_id",
        value: tournamentId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256),
      },
    ],
  };
}

/**
 * Sends the member version of the email to one admin for preview. Uses the
 * single-send endpoint without an idempotency key so repeated test presses
 * all arrive, and tags it separately so tests stay out of member stats.
 */
export async function sendRegistrationOpeningMemberPreviewEmail(
  apiKey: string,
  recipient: RegistrationOpeningMemberRecipient,
  tournamentId: string,
  params: RegistrationOpeningAdminEmailParams,
): Promise<void> {
  const email = buildRegistrationOpeningMemberEmail(
    recipient,
    tournamentId,
    params,
    UTM_CAMPAIGN.REGISTRATION_OPENING_PREVIEW,
  );
  await callResendApi(apiKey, {
    ...email,
    subject: `[Test] ${email.subject}`,
    tags: email.tags?.map((tag) =>
      tag.name === "category"
        ? { ...tag, value: "registration_opening_preview" }
        : tag,
    ),
  });
}
