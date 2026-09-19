const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FROM_EMAIL = "Ridgefield Golf Club <noreply@ridgefieldgolfclub.org>";
const BASE_URL = "https://ridgefieldgolfclub.org";
const CONTACT_EMAIL = "RidgefieldCTGolfClub@gmail.com";

export interface RegistrationOpeningAdminEmailParams {
  tournamentTitle: string;
  tournamentUrl: string;
  tournamentDate?: string;
  registrationCloses?: string;
  tournamentTee: string;
  tournamentTeeTimes: string;
  fieldSize?: string;
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

function buildDetailRow(label: string, value: string | undefined): string {
  if (!value) return "";

  if (label === "Tee") {
    const { backgroundColor, color } = getTeeBadgeStyle(value);
    return `<tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;"><strong>${esc(label)}:</strong> <span style="display:inline-block;background-color:${backgroundColor};color:${color};padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;line-height:1.4;vertical-align:middle;">${esc(value)}</span></p></td></tr>`;
  }

  return `<tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;"><strong>${esc(label)}:</strong> ${esc(value)}</p></td></tr>`;
}

export function buildRegistrationOpeningAdminEmailHtml(
  params: RegistrationOpeningAdminEmailParams,
): string {
  const {
    tournamentTitle,
    tournamentUrl,
    tournamentDate,
    registrationCloses,
    tournamentTee,
    tournamentTeeTimes,
    fieldSize,
  } = params;

  const detailsRows = [
    buildDetailRow("Date", tournamentDate),
    buildDetailRow("Registration closes", registrationCloses),
    buildDetailRow("Tee", tournamentTee),
    buildDetailRow("Tee times", tournamentTeeTimes),
    buildDetailRow("Field size", fieldSize),
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Registration Open: ${esc(tournamentTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">
          <tr>
            <td bgcolor="#1a5c2e" align="center" style="background-color:#1a5c2e;border-radius:13px 13px 0 0;padding:32px 40px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" align="center" style="background-color:#ffffff;border-radius:8px;padding:8px 20px;">
                    <img src="https://www.ridgefieldgolfclub.org/rgc_logo.png" width="160" height="48" border="0" alt="Ridgefield Golf Club" style="display:block;width:160px;height:auto;border:0;">
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:26px;color:#ffffff;font-family:${FONT};font-weight:700;line-height:1.3;">&#9971; Registration Is Open</p>
              <p style="margin:8px 0 0;font-size:14px;color:#bbf7d0;font-family:${FONT};line-height:1.5;">A new tournament is now open for member registration.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">Registration has opened for <strong>${esc(tournamentTitle)}</strong>, and we invite all members to sign up now.</p>
              <p style="margin:10px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">Please review the tournament details below and register through the link provided.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;border-radius:10px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Tournament Details</p>
                    <p style="margin:12px 0 0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.7;">Hello RGC Members,</p>
                    <p style="margin:12px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.7;">Registration is now open for <strong>${esc(tournamentTitle)}</strong>. We hope you can join us. Please review the details below and register early through the tournament page.</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                      ${detailsRows}
                    </table>
                    <p style="margin:12px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.7;">We look forward to seeing everyone there, and please register early so we can plan the field and manage waitlist demand if needed.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <a href="${esc(tournamentUrl)}" target="_blank" style="display:inline-block;background-color:#006fee;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:10px;">View Tournament &amp; Register &#8594;</a>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #e4e4e7;font-size:1px;line-height:1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 0;">
              <p style="margin:0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Tournament page: <a href="${esc(tournamentUrl)}" style="color:#006fee;text-decoration:underline;">${esc(tournamentUrl.replace(`${BASE_URL}`, ""))}</a></p>
              <p style="margin:8px 0 0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Questions? Email us at <a href="mailto:${CONTACT_EMAIL}" style="color:#006fee;text-decoration:underline;">${CONTACT_EMAIL}</a></p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 40px 28px;">
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
    throw new Error(`Resend API error ${response.status}: ${text}`);
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
    subject: `Registration Open: ${params.tournamentTitle}`,
    html: buildRegistrationOpeningAdminEmailHtml(params),
  });
}
