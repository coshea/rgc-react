/**
 * Email template builder and Resend API helper for bracket matchup alerts.
 */

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FROM_EMAIL = "Ridgefield Golf Club <noreply@ridgefieldgolfclub.org>";
const CONTACT_EMAIL = "RidgefieldCTGolfClub@gmail.com";

export interface BracketMatchupEmailParams {
  firstName: string;
  tournamentTitle: string;
  roundLabel: string;
  yourTeamName: string;
  opponentTeamName: string;
  matchupLabel: string;
  tournamentUrl: string;
}

/** Minimal HTML entity escaping for dynamic values rendered in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTrackedUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return (
    url +
    separator +
    "utm_source=email" +
    "&utm_medium=email" +
    "&utm_campaign=bracket_matchup" +
    "&utm_content=player_alert"
  );
}

export function buildBracketMatchupEmailHtml(
  p: BracketMatchupEmailParams,
): string {
  const trackedUrl = buildTrackedUrl(p.tournamentUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>New Bracket Matchup</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">

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
              <p style="margin:20px 0 0;font-size:26px;color:#ffffff;font-family:${FONT};font-weight:700;line-height:1.3;">&#127919; New Matchup Set</p>
              <p style="margin:8px 0 0;font-size:14px;color:#bbf7d0;font-family:${FONT};line-height:1.5;">Your opponent has been locked in.</p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">Hi <strong>${esc(p.firstName)}</strong>,</p>
              <p style="margin:10px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">You have a new matchup in <strong>${esc(p.tournamentTitle)}</strong>.</p>
            </td>
          </tr>

          <!-- MATCHUP DETAILS -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;border-radius:10px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Matchup Details</p>
                    <p style="margin:8px 0 0;font-size:17px;color:#11181c;font-family:${FONT};font-weight:700;line-height:1.4;">${esc(p.matchupLabel)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#127942; <strong>Round:</strong> ${esc(p.roundLabel)}</p></td></tr>
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#128100; <strong>Your Team:</strong> ${esc(p.yourTeamName)}</p></td></tr>
                      <tr><td><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#127919; <strong>Opponent:</strong> ${esc(p.opponentTeamName)}</p></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <a href="${esc(trackedUrl)}" target="_blank" style="display:inline-block;background-color:#006fee;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:10px;">View Bracket &#8594;</a>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:28px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="border-top:1px solid #e4e4e7;font-size:1px;line-height:1px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- CONTACT + FOOTER -->
          <tr>
            <td style="padding:20px 40px 0;">
              <p style="margin:0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Questions? Email us at <a href="mailto:${CONTACT_EMAIL}" style="color:#006fee;text-decoration:underline;">${CONTACT_EMAIL}</a></p>
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
      // Ignore parse failures and fall back to a status-only error message.
    }

    const details = [
      errorCode ? `code=${errorCode}` : undefined,
      errorId ? `id=${errorId}` : undefined,
    ]
      .filter((detail): detail is string => Boolean(detail))
      .join(", ");

    throw new Error(
      details
        ? `Resend API error ${response.status} (${details})`
        : `Resend API error ${response.status}`,
    );
  }
}

export async function sendBracketMatchupEmail(
  apiKey: string,
  to: string,
  params: BracketMatchupEmailParams,
): Promise<void> {
  await callResendApi(apiKey, {
    from: FROM_EMAIL,
    to: [to],
    subject: `New matchup: ${params.tournamentTitle} (${params.roundLabel})`,
    html: buildBracketMatchupEmailHtml(params),
  });
}
