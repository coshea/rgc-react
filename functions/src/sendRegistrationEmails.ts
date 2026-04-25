/**
 * Email template builders and Resend API helper for tournament registration
 * confirmation emails.
 *
 * Emails are sent via the Resend REST API using Node 22's native fetch.
 * No additional npm dependency is needed.
 */

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const FROM_EMAIL = "Ridgefield Golf Club <noreply@ridgefieldgolfclub.org>";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TeamMemberEntry {
  id: string;
  displayName?: string;
  goldTee?: boolean;
}

export interface LeaderEmailParams {
  firstName: string;
  tournamentTitle: string;
  tournamentDate: string;
  /** Tee color label, e.g. "White" or "Mixed". */
  tournamentTee: string;
  /** Tee times label matching the detail page, e.g. "Assigned" or "Get your own". */
  tournamentTeeTimes: string;
  teamMembersHtml: string;
  tournamentUrl: string;
}

export interface MemberEmailParams extends LeaderEmailParams {
  leaderName: string;
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

/**
 * Appends UTM parameters to a tournament URL so clicks appear in GA4 under
 * Acquisition → Traffic acquisition.
 */
function buildTrackedUrl(url: string, content: "leader" | "member"): string {
  const separator = url.includes("?") ? "&" : "?";
  return (
    url +
    separator +
    "utm_source=email" +
    "&utm_medium=email" +
    "&utm_campaign=tournament_registration" +
    `&utm_content=${content}`
  );
}

/**
 * Builds the team roster as `<tr>` rows for use inside the team table in
 * both email templates.
 */
export function buildTeamMembersHtml(
  team: TeamMemberEntry[],
  ownerId: string,
): string {
  return team
    .map((member, i) => {
      const isLeader = member.id === ownerId;
      const name = esc(member.displayName || "Unknown Member");
      const goldLabel = member.goldTee
        ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:#854d0e;background-color:#fef9c3;border:1px solid #fde047;border-radius:4px;padding:1px 6px;font-family:${FONT};margin-left:8px;vertical-align:middle;line-height:1.5;">&#9733; Gold Tees</span>`
        : "";
      const leaderBadge = isLeader
        ? `<span style="font-size:12px;color:#71717a;font-family:${FONT};margin-left:8px;">(Team Leader)</span>`
        : "";
      const borderBottom =
        i < team.length - 1 ? "border-bottom:1px solid #e4e4e7;" : "";
      const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
      return (
        `<tr>` +
        `<td bgcolor="${bg}" style="background-color:${bg};padding:12px 20px;` +
        `font-size:14px;color:#11181c;font-family:${FONT};line-height:1.5;${borderBottom}">` +
        `${name}${goldLabel}${leaderBadge}` +
        `</td>` +
        `</tr>`
      );
    })
    .join("\n");
}

// ── HTML Builders ─────────────────────────────────────────────────────────────

export function buildLeaderEmailHtml(p: LeaderEmailParams): string {
  const {
    firstName,
    tournamentTitle,
    tournamentDate,
    tournamentTee,
    tournamentTeeTimes,
    teamMembersHtml,
    tournamentUrl,
  } = p;
  const trackedUrl = buildTrackedUrl(tournamentUrl, "leader");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Tournament Registration Confirmed</title>
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
              <p style="margin:20px 0 0;font-size:26px;color:#ffffff;font-family:${FONT};font-weight:700;line-height:1.3;">&#9971; You're Registered!</p>
              <p style="margin:8px 0 0;font-size:14px;color:#bbf7d0;font-family:${FONT};line-height:1.5;">Your team is confirmed for the tournament.</p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">Hi <strong>${esc(firstName)}</strong>,</p>
              <p style="margin:10px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">Great news &#8212; your team is registered for <strong>${esc(tournamentTitle)}</strong>. Here&#39;s everything you need to know.</p>
            </td>
          </tr>

          <!-- TOURNAMENT DETAILS -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;border-radius:10px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Tournament Details</p>
                    <p style="margin:8px 0 0;font-size:17px;color:#11181c;font-family:${FONT};font-weight:700;line-height:1.4;">${esc(tournamentTitle)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#128197; <strong>Date:</strong> ${esc(tournamentDate)}</p></td></tr>
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#9971; <strong>Tee:</strong> ${esc(tournamentTee)}</p></td></tr>
                      <tr><td><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#128336; <strong>Tee Times:</strong> ${esc(tournamentTeeTimes)}</p></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TEAM MEMBERS -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 10px;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Your Team</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;">
                ${teamMembersHtml}
              </table>
            </td>
          </tr>

          <!-- LEADER CALLOUT -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fefce8;border-radius:10px;border:1px solid #fde047;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#713f12;font-family:${FONT};font-weight:700;line-height:1.5;">&#9998; As team leader, you can manage this registration</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:13px;color:#713f12;font-family:${FONT};line-height:1.6;"><strong>Edit team members:</strong> Visit the tournament page and open your registration to add or swap players.</p></td></tr>
                      <tr><td><p style="margin:0;font-size:13px;color:#713f12;font-family:${FONT};line-height:1.6;"><strong>Cancel registration:</strong> Open your registration on the tournament page and tap <em>Cancel Registration</em>.</p></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <a href="${esc(trackedUrl)}" target="_blank" style="display:inline-block;background-color:#006fee;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:10px;">View Tournament &#8594;</a>
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
              <p style="margin:0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Questions? Email us at <a href="mailto:RidgefieldCTGolfClub@gmail.com" style="color:#006fee;text-decoration:underline;">RidgefieldCTGolfClub@gmail.com</a></p>
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

export function buildMemberEmailHtml(p: MemberEmailParams): string {
  const {
    firstName,
    leaderName,
    tournamentTitle,
    tournamentDate,
    tournamentTee,
    tournamentTeeTimes,
    teamMembersHtml,
    tournamentUrl,
  } = p;
  const trackedUrl = buildTrackedUrl(tournamentUrl, "member");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>You've Been Added to a Tournament Team</title>
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
              <p style="margin:20px 0 0;font-size:26px;color:#ffffff;font-family:${FONT};font-weight:700;line-height:1.3;">&#9971; You&#39;re on the Team!</p>
              <p style="margin:8px 0 0;font-size:14px;color:#bbf7d0;font-family:${FONT};line-height:1.5;">You&#39;ve been added to a tournament team.</p>
            </td>
          </tr>

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#11181c;font-family:${FONT};line-height:1.6;">Hi <strong>${esc(firstName)}</strong>,</p>
              <p style="margin:10px 0 0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;"><strong>${esc(leaderName)}</strong> has added you to their team for <strong>${esc(tournamentTitle)}</strong>. Here&#39;s what you need to know.</p>
            </td>
          </tr>

          <!-- TOURNAMENT DETAILS -->
          <tr>
            <td style="padding:24px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;border-radius:10px;border:1px solid #e4e4e7;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Tournament Details</p>
                    <p style="margin:8px 0 0;font-size:17px;color:#11181c;font-family:${FONT};font-weight:700;line-height:1.4;">${esc(tournamentTitle)}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#128197; <strong>Date:</strong> ${esc(tournamentDate)}</p></td></tr>
                      <tr><td style="padding-bottom:6px;"><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#9971; <strong>Tee:</strong> ${esc(tournamentTee)}</p></td></tr>
                      <tr><td><p style="margin:0;font-size:14px;color:#3f3f46;font-family:${FONT};line-height:1.5;">&#128336; <strong>Tee Times:</strong> ${esc(tournamentTeeTimes)}</p></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TEAM MEMBERS -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 10px;font-size:11px;color:#71717a;font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:1.5px;line-height:1.4;">Your Team</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;">
                ${teamMembersHtml}
              </table>
            </td>
          </tr>

          <!-- MEMBER INFO CALLOUT -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e6f1fe;border-radius:10px;border:1px solid #bdd7f9;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#004493;font-family:${FONT};font-weight:700;line-height:1.5;">&#8505; Need to make changes?</p>
                    <p style="margin:8px 0 0;font-size:13px;color:#004493;font-family:${FONT};line-height:1.6;">Contact your team leader <strong>${esc(leaderName)}</strong> if you need to be removed or if any details look incorrect. Only the team leader can update the registration.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <a href="${esc(trackedUrl)}" target="_blank" style="display:inline-block;background-color:#006fee;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:10px;">View Tournament &#8594;</a>
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
              <p style="margin:0;font-size:13px;color:#71717a;font-family:${FONT};line-height:1.6;">Questions? Email us at <a href="mailto:RidgefieldCTGolfClub@gmail.com" style="color:#006fee;text-decoration:underline;">RidgefieldCTGolfClub@gmail.com</a></p>
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
    throw new Error(`Resend API error ${response.status}: ${text}`);
  }
}

export async function sendTournamentLeaderEmail(
  apiKey: string,
  to: string,
  params: LeaderEmailParams,
): Promise<void> {
  await callResendApi(apiKey, {
    from: FROM_EMAIL,
    to: [to],
    subject: `You're Registered: ${params.tournamentTitle}`,
    html: buildLeaderEmailHtml(params),
  });
}

export async function sendTournamentMemberEmail(
  apiKey: string,
  to: string,
  params: MemberEmailParams,
): Promise<void> {
  await callResendApi(apiKey, {
    from: FROM_EMAIL,
    to: [to],
    subject: `You've been added to a team: ${params.tournamentTitle}`,
    html: buildMemberEmailHtml(params),
  });
}
