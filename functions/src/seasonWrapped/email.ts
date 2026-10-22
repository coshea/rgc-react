import type { ResendBatchEmail } from "../resendBatch";
import {
  BASE_URL,
  CONTACT_EMAIL,
  FONT,
  FROM_EMAIL,
  MANAGE_NOTIFICATIONS_URL,
  listUnsubscribeHeaders,
  withUtm,
} from "../sendRegistrationOpeningEmails";
import {
  SEASON_WRAPPED_EMAIL_CATEGORY,
  seasonWrappedPath,
  type ClubSeasonStats,
  type SeasonWrappedMember,
} from "./types";

const COLORS = {
  night: "#0c2a1c",
  fairway: "#2c8a4b",
  flag: "#f4c430",
  chalk: "#fbf8f0",
  ink: "#11181c",
  muted: "#71717a",
};

export function seasonWrappedCampaign(year: number): string {
  return `season_wrapped_${year}`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

interface HeadlineStat {
  value: string;
  label: string;
}

/** Three headline numbers: the member's own when they played, the club's otherwise. */
export function headlineStats(
  member: SeasonWrappedMember,
  club: ClubSeasonStats,
): HeadlineStat[] {
  if (member.played && member.events) {
    const stats: HeadlineStat[] = [
      {
        value: String(member.events.played),
        label: member.events.played === 1 ? "event played" : "events played",
      },
    ];
    if (member.money) {
      stats.push({
        value: money(member.money.total),
        label: member.money.rankLabel ? `won · #${member.money.rankLabel}` : "won",
      });
    }
    if (member.closestToPin?.count) {
      stats.push({ value: String(member.closestToPin.count), label: "closest to pin" });
    } else if (member.crew?.distinctTeammates) {
      stats.push({ value: String(member.crew.distinctTeammates), label: "teammates" });
    }
    return stats.slice(0, 3);
  }
  return [
    { value: String(club.tournamentCount), label: "tournaments" },
    { value: String(club.playerCount), label: "members played" },
    { value: money(club.prizeMoneyPaid), label: "paid out" },
  ];
}

export function buildSeasonWrappedSubject(member: SeasonWrappedMember): string {
  return `Your ${member.year} RGC year in review`;
}

function preheaderFor(member: SeasonWrappedMember, club: ClubSeasonStats): string {
  const stats = headlineStats(member, club)
    .map((s) => `${s.value} ${s.label}`)
    .join(", ");
  return `${stats}. Your ${member.year} season at Ridgefield Golf Club, event by event.`;
}

function introFor(member: SeasonWrappedMember): string {
  return member.played
    ? `Your ${member.year} year in review is ready. It covers the events you played, your results and winnings, how the year's majors finished and the club's season in numbers.`
    : `The club's ${member.year} year in review is ready. It covers the year's majors, the top of the money list and the season in numbers.`;
}

export function buildSeasonWrappedLink(year: number): string {
  return withUtm(
    `${BASE_URL}${seasonWrappedPath(year)}`,
    seasonWrappedCampaign(year),
    "story",
  );
}

export function buildSeasonWrappedEmailHtml(
  member: SeasonWrappedMember,
  club: ClubSeasonStats,
  link: string,
  unsubscribeUrl?: string,
): string {
  const stats = headlineStats(member, club);
  const width = Math.floor(100 / stats.length);
  const statCells = stats
    .map(
      (s) =>
        `<td width="${width}%" align="center" style="padding:16px 8px;font-family:${FONT};color:${COLORS.chalk};"><div style="font-size:30px;font-weight:800;line-height:1.1;">${esc(s.value)}</div><div style="font-size:12px;line-height:1.4;margin-top:4px;">${esc(s.label)}</div></td>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(buildSeasonWrappedSubject(member))}</title>
  <style>
    @media only screen and (max-width:600px) {
      .rgc-px { padding-left:20px !important; padding-right:20px !important; }
      .rgc-btn { display:block !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f4f5;opacity:0;">${esc(preheaderFor(member, club))}</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;border:1px solid #e4e4e7;">
          <tr>
            <td class="rgc-px" bgcolor="${COLORS.night}" style="background-color:${COLORS.night};border-radius:13px 13px 0 0;padding:32px 40px;">
              <p style="margin:0;font-size:13px;color:${COLORS.chalk};font-family:${FONT};font-weight:600;text-transform:uppercase;letter-spacing:2px;">RGC ${member.year} Year in Review</p>
              <p style="margin:10px 0 0;font-size:34px;color:${COLORS.flag};font-family:${FONT};font-weight:800;line-height:1.15;">${esc(member.firstName)}, your ${member.year} season in review.</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.fairway}" style="background-color:${COLORS.fairway};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${statCells}</tr></table>
            </td>
          </tr>
          <tr>
            <td class="rgc-px" style="padding:28px 40px 0;">
              <p style="margin:0;font-size:15px;color:#3f3f46;font-family:${FONT};line-height:1.6;">${esc(introFor(member))}</p>
            </td>
          </tr>
          <tr>
            <td class="rgc-px" align="left" style="padding:24px 40px 0;">
              <a class="rgc-btn" href="${esc(link)}" target="_blank" style="display:inline-block;background-color:${COLORS.flag};color:${COLORS.ink};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">View my year in review</a>
            </td>
          </tr>
          <tr>
            <td class="rgc-px" style="padding:28px 40px 28px;">
              <p style="margin:0;font-size:13px;color:${COLORS.muted};font-family:${FONT};line-height:1.6;">If the button doesn&#39;t work, copy this link into your browser:<br><a href="${esc(link)}" style="color:#006fee;text-decoration:underline;word-break:break-all;">${esc(BASE_URL + seasonWrappedPath(member.year))}</a></p>
              <p style="margin:8px 0 0;font-size:13px;color:${COLORS.muted};font-family:${FONT};line-height:1.6;">You&#39;re receiving this email because you&#39;re a ${member.year} Ridgefield Golf Club member with general announcement emails turned on. <a href="${esc(MANAGE_NOTIFICATIONS_URL)}" style="color:#006fee;text-decoration:underline;">Manage email preferences</a>${unsubscribeUrl ? ` &middot; <a href="${esc(unsubscribeUrl)}" style="color:#006fee;text-decoration:underline;">Unsubscribe</a>` : ""}</p>
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;font-family:${FONT};line-height:1.6;">Ridgefield Golf Club &bull; PO Box 24, Ridgefield, CT 06877</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildSeasonWrappedEmailText(
  member: SeasonWrappedMember,
  club: ClubSeasonStats,
  link: string,
  unsubscribeUrl?: string,
): string {
  return [
    `RGC ${member.year} YEAR IN REVIEW`,
    "",
    `${member.firstName}, your ${member.year} season in review.`,
    "",
    ...headlineStats(member, club).map((s) => `${s.value} ${s.label}`),
    "",
    introFor(member),
    "",
    `View my year in review: ${link}`,
    "",
    "---",
    `Questions? Email us at ${CONTACT_EMAIL}.`,
    `You're receiving this email because you're a ${member.year} Ridgefield Golf Club member with general announcement emails turned on.`,
    `Manage email preferences: ${MANAGE_NOTIFICATIONS_URL}`,
    ...(unsubscribeUrl ? [`Unsubscribe: ${unsubscribeUrl}`] : []),
    "Ridgefield Golf Club, PO Box 24, Ridgefield, CT 06877",
  ].join("\n");
}

/** Resend tag values may only hold ASCII letters, digits, `_` and `-`. */
const RESEND_TAG_VALUE = /^[A-Za-z0-9_-]+$/;

/**
 * Tags the member's uid as is when Resend allows it, else base64url-encoded
 * (same alphabet) under `uid_b64`, so the webhook can recover it exactly.
 */
export function seasonWrappedUidTag(uid: string): { name: string; value: string } {
  return RESEND_TAG_VALUE.test(uid)
    ? { name: "uid", value: uid }
    : { name: "uid_b64", value: Buffer.from(uid, "utf8").toString("base64url") };
}

/** Reverses `seasonWrappedUidTag`. */
export function uidFromSeasonWrappedTags(tags: Record<string, string>): string | undefined {
  if (tags.uid_b64) return Buffer.from(tags.uid_b64, "base64url").toString("utf8") || undefined;
  return tags.uid || undefined;
}

/**
 * One member's Wrapped email for the Resend batch API. Tags carry the uid and
 * year so `resend_webhook` can record link clicks against the member.
 * `unsubscribeUrl` is the recipient's signed one-click link (emailUnsubscribe.ts).
 */
export function buildSeasonWrappedEmail(
  email: string,
  member: SeasonWrappedMember,
  club: ClubSeasonStats,
  unsubscribeUrl?: string,
): ResendBatchEmail {
  const link = buildSeasonWrappedLink(member.year);
  return {
    from: FROM_EMAIL,
    to: [email],
    subject: buildSeasonWrappedSubject(member),
    html: buildSeasonWrappedEmailHtml(member, club, link, unsubscribeUrl),
    text: buildSeasonWrappedEmailText(member, club, link, unsubscribeUrl),
    headers: listUnsubscribeHeaders(unsubscribeUrl),
    tags: [
      { name: "category", value: SEASON_WRAPPED_EMAIL_CATEGORY },
      { name: "year", value: String(member.year) },
      seasonWrappedUidTag(member.uid),
    ],
  };
}
