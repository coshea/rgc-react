import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import type { SeasonWrappedMember } from "./types";

/** Square share image; fits feeds, texts and most share targets. */
export const SHARE_IMAGE_SIZE = 1080;

const COLORS = {
  fairway: "#2c8a4b",
  night: "#0c2a1c",
  flag: "#f4c430",
  chalk: "#fbf8f0",
  ink: "#0b1a12",
};

const DISPLAY = "Big Shoulders Display";
const BODY = "Figtree";

type FontWeight = 500 | 700 | 800 | 900;
interface FontDef {
  name: string;
  data: Buffer;
  weight: FontWeight;
  style: "normal";
}

let fonts: FontDef[] | null = null;

/** Bundled TTFs (satori can't read woff2 or variable fonts). */
function loadFonts(): FontDef[] {
  if (fonts) return fonts;
  const dir = join(__dirname, "..", "..", "assets", "fonts");
  const font = (file: string, name: string, weight: FontWeight): FontDef => ({
    name,
    data: readFileSync(join(dir, file)),
    weight,
    style: "normal",
  });
  fonts = [
    font("BigShouldersDisplay-800.ttf", DISPLAY, 800),
    font("BigShouldersDisplay-900.ttf", DISPLAY, 900),
    font("Figtree-500.ttf", BODY, 500),
    font("Figtree-700.ttf", BODY, 700),
  ];
  return fonts;
}

// Satori takes React-element-shaped objects; a tiny builder avoids JSX in functions.
type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[] };
}
type Child = Node | string;

function el(style: Style, ...children: Child[]): Node {
  return {
    type: "div",
    props: {
      style: { display: "flex", ...style },
      children: children.length === 1 ? children[0] : children,
    },
  };
}

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

interface ShareStat {
  value: string;
  label: string;
}

/** Up to four stats for the grid; members who didn't play get club-flavored copy. */
export function shareStats(member: SeasonWrappedMember): ShareStat[] {
  const { share } = member;
  const stats: ShareStat[] = [];
  if (share.events > 0) {
    stats.push({ value: String(share.events), label: share.events === 1 ? "event" : "events" });
  }
  if (share.total > 0) {
    stats.push({
      value: formatMoney(share.total),
      label: share.rankLabel ? `won · #${share.rankLabel}` : "won",
    });
  }
  if (share.closestToPins > 0) {
    stats.push({
      value: String(share.closestToPins),
      label: share.closestToPins === 1 ? "closest to pin" : "closest to pins",
    });
  }
  if (share.topPartner) {
    stats.push({ value: share.topPartner, label: "top partner" });
  }
  if (stats.length === 0) {
    stats.push({ value: String(member.year), label: "RGC member" });
  }
  return stats.slice(0, 4);
}

export function buildShareImageTree(member: SeasonWrappedMember): Node {
  const nameParts = member.displayName.trim().split(/\s+/);
  const first = nameParts[0] ?? member.firstName;
  const rest = nameParts.slice(1).join(" ");
  const stats = shareStats(member);

  const statCell = (s: ShareStat): Node =>
    el(
      { flexDirection: "column", width: "50%", paddingTop: 28 },
      el(
        {
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: s.value.length > 9 ? 64 : 92,
          lineHeight: 1,
          color: COLORS.ink,
        },
        s.value,
      ),
      el(
        {
          fontFamily: BODY,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: COLORS.fairway,
          marginTop: 8,
        },
        s.label,
      ),
    );

  return el(
    {
      width: SHARE_IMAGE_SIZE,
      height: SHARE_IMAGE_SIZE,
      backgroundColor: COLORS.fairway,
      paddingTop: 64,
      paddingLeft: 64,
      flexDirection: "column",
    },
    el(
      {
        // Satori adds padding outside an explicit width/height (content-box):
        // 952×882 outer box = 64px page margins, 64px card padding, 70px footer.
        width: SHARE_IMAGE_SIZE - 128 - 128,
        height: SHARE_IMAGE_SIZE - 128 - 70 - 128,
        backgroundColor: COLORS.chalk,
        borderRadius: 40,
        padding: 64,
        flexDirection: "column",
      },
      el(
        {
          fontFamily: BODY,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: COLORS.fairway,
        },
        `RGC Wrapped ${member.year}`,
      ),
      el(
        {
          flexDirection: "column",
          marginTop: 24,
          fontFamily: DISPLAY,
          fontWeight: 900,
          fontSize: 132,
          lineHeight: 0.9,
          textTransform: "uppercase",
          color: COLORS.night,
        },
        el({}, first),
        ...(rest ? [el({}, rest)] : []),
      ),
      el(
        { flexWrap: "wrap", marginTop: "auto" },
        ...stats.map(statCell),
      ),
    ),
    el(
      {
        width: SHARE_IMAGE_SIZE - 128,
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 34,
        fontFamily: BODY,
        fontWeight: 700,
        fontSize: 28,
        color: COLORS.chalk,
      },
      el({}, "Ridgefield Golf Club"),
      el({ color: COLORS.flag }, "ridgefieldgolfclub.org"),
    ),
  );
}

/** Renders the member's share card to a PNG. */
export async function renderShareImage(member: SeasonWrappedMember): Promise<Buffer> {
  const svg = await satori(buildShareImageTree(member) as unknown as Parameters<typeof satori>[0], {
    width: SHARE_IMAGE_SIZE,
    height: SHARE_IMAGE_SIZE,
    fonts: loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: SHARE_IMAGE_SIZE } }).render();
  return png.asPng();
}
