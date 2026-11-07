import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import {
  moneyWonLabel,
  sealShowsMoneyRank,
  seasonTagColor,
  shareStamp,
  TAG_GROMMET,
  TAG_STRAP_COLORS,
  tagStrapSvg,
  type SeasonWrappedMember,
  type ShareStamp,
} from "./types";

/** Square share image (a member bag tag); fits feeds, texts and most share targets. */
export const SHARE_IMAGE_SIZE = 1080;

/** The band and stat labels use the season's color (`seasonTagColor`). */
const COLORS = {
  night: "#0c2a1c",
  flag: "#f4c430",
  /** The seal's ring and type. */
  sealInk: "#5c4300",
  white: "#ffffff",
  ink: "#0b1a12",
  /** Pure white so the logo PNG's white background blends in. */
  tag: "#ffffff",
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

const ASSETS = join(__dirname, "..", "..", "assets");

let fonts: FontDef[] | null = null;

/** Bundled TTFs (satori can't read woff2 or variable fonts). */
function loadFonts(): FontDef[] {
  if (fonts) return fonts;
  const font = (file: string, name: string, weight: FontWeight): FontDef => ({
    name,
    data: readFileSync(join(ASSETS, "fonts", file)),
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

let logo: string | null = null;

/** The club logo (dark text on white, same file as src/assets/rgc_logo.png) as a data URI. */
function loadLogo(): string {
  if (logo) return logo;
  logo = `data:image/png;base64,${readFileSync(join(ASSETS, "images", "rgc_logo.png")).toString("base64")}`;
  return logo;
}

// Satori takes React-element-shaped objects; a tiny builder avoids JSX in functions.
type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[]; src?: string; width?: number; height?: number };
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

function img(src: string, width: number, height: number, style: Style = {}): Node {
  return { type: "img", props: { src, width, height, style: { width, height, ...style } } };
}

function svgDataUri(width: number, height: number, body: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

interface ShareStat {
  value: string;
  label: string;
  /** A person's name: first name on one line, the rest below. */
  isName?: boolean;
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
      label: moneyWonLabel(share.rankLabel, sealShowsMoneyRank(member)),
    });
  }
  if (share.closestToPins > 0) {
    stats.push({
      value: String(share.closestToPins),
      label: share.closestToPins === 1 ? "closest to pin" : "closest to pins",
    });
  }
  if (share.topPartner) {
    stats.push({ value: share.topPartner, label: "top partner", isName: true });
  }
  if (stats.length === 0) {
    stats.push({ value: String(member.year), label: "RGC member" });
  }
  return stats.slice(0, 4);
}

/** First word on one line, the rest below. */
function splitName(name: string): string[] {
  const [first = "", ...rest] = name.trim().split(/\s+/);
  return rest.length > 0 ? [first, rest.join(" ")] : [first];
}

/** Longest unbreakable run, which decides how large a line can be set. */
function longestWord(text: string): number {
  return Math.max(0, ...text.split(/\s+/).map((w) => w.length));
}

// Bag tag geometry. Satori adds padding outside an explicit width/height
// (content-box), so padded boxes are sized by their inner dimensions.
const TAG = { left: 190, top: 130, width: 700, height: 910, radius: 64, band: 150, padX: 56, padTop: 36, padBottom: 44 };
const TAG_INNER = TAG.width - TAG.padX * 2;
/** Grommet, where the strap passes through (shared with the site: TAG_GROMMET). */
const HOLE = { y: TAG.top + TAG_GROMMET.y, r: TAG_GROMMET.r, ring: TAG_GROMMET.ring };
/** Member photo (or initials) beside the name, ringed in the season color. */
const AVATAR = { size: 150, ring: 6, gap: 28 };
/** Width left for the name beside the avatar. */
const NAME_WIDTH = TAG_INNER - AVATAR.size - AVATAR.gap;
/** Stitching just inside the tag's edge. */
const STITCH = { inset: 18, width: 3 };

/** Stat value size, so the longest word still fits its half-width column. */
export function shareStatFontSize(s: ShareStat): number {
  const longest = s.isName ? longestWord(s.value) : s.value.length;
  if (longest > 10) return 50;
  if (longest > 7) return 64;
  return 84;
}

/** Name size beside the avatar: Big Shoulders caps run about half an em wide. */
export function shareNameFontSize(name: string): number {
  return Math.max(44, Math.min(104, Math.floor(NAME_WIDTH / (longestWord(name) * 0.5))));
}

/**
 * Up to two initials, exactly as the site's UserAvatar fallback
 * (getInitials in src/components/avatar.tsx).
 */
export function avatarInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The member's photo, or initials when they have none (`photo` from loadSharePhoto). */
function avatar(member: SeasonWrappedMember, accent: string, photo?: string): Node {
  const inner = AVATAR.size - AVATAR.ring * 2;
  return el(
    {
      width: inner,
      height: inner,
      flexShrink: 0,
      borderRadius: 999,
      border: `${AVATAR.ring}px solid ${accent}`,
      overflow: "hidden",
      backgroundColor: COLORS.night,
      alignItems: "center",
      justifyContent: "center",
      fontFamily: DISPLAY,
      fontWeight: 800,
      fontSize: 64,
      color: COLORS.flag,
    },
    photo ? img(photo, inner, inner, { objectFit: "cover" }) : avatarInitials(member.displayName),
  );
}

/** Dashed stitching just inside the tag's edge, like a leather tag. */
function stitching(): Node {
  return el({
    position: "absolute",
    left: STITCH.inset,
    top: STITCH.inset,
    width: TAG.width - STITCH.inset * 2 - STITCH.width * 2,
    height: TAG.height - STITCH.inset * 2 - STITCH.width * 2,
    borderRadius: TAG.radius - STITCH.inset + 4,
    border: `${STITCH.width}px dashed rgba(12,42,28,0.4)`,
  });
}

/** The leather strap through the grommet (`tagStrapSvg`), from the image's top edge. */
const STRAP_HEIGHT = TAG.top + 150;
function strap(): string {
  return svgDataUri(TAG.width, STRAP_HEIGHT, `<svg viewBox="0 ${-TAG.top} ${TAG.width} ${STRAP_HEIGHT}" width="${TAG.width}" height="${STRAP_HEIGHT}">${tagStrapSvg(TAG.top)}</svg>`);
}

const SEAL = { size: 200, right: 28, top: TAG.band - 78, rotate: -10 };

/** A gold seal over the band's right corner. */
function seal(stamp: ShareStamp, year: number): Node {
  const ring = (inset: number, width: number): Node =>
    el({
      position: "absolute",
      left: inset,
      top: inset,
      width: SEAL.size - inset * 2 - width * 2,
      height: SEAL.size - inset * 2 - width * 2,
      borderRadius: 999,
      border: `${width}px solid ${COLORS.sealInk}`,
    });
  return el(
    {
      position: "absolute",
      right: SEAL.right,
      top: SEAL.top,
      width: SEAL.size,
      height: SEAL.size,
      borderRadius: 999,
      backgroundColor: COLORS.flag,
      transform: `rotate(${SEAL.rotate}deg)`,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: COLORS.sealInk,
    },
    ring(6, 4),
    ring(18, 2),
    el({ fontFamily: BODY, fontWeight: 700, fontSize: 18 }, String(year)),
    el(
      {
        width: SEAL.size - 64,
        justifyContent: "center",
        textAlign: "center",
        fontFamily: DISPLAY,
        fontWeight: 900,
        fontSize: stamp.main.length > 12 ? 30 : 36,
        lineHeight: 0.92,
        textTransform: "uppercase",
        marginTop: 4,
      },
      stamp.main,
    ),
    ...(stamp.detail ? [el({ fontFamily: BODY, fontWeight: 700, fontSize: 18, marginTop: 6 }, stamp.detail)] : []),
  );
}

/**
 * A stitched club bag tag on a leather strap: the season's band color and
 * year, the logo, the member's photo (or initials) and name, up to four
 * stats and an optional gold seal
 * (`shareStamp`). The site's share card (`.wr-sharecard` in wrapped.css) mirrors it.
 */
export function buildShareImageTree(member: SeasonWrappedMember, photo?: string): Node {
  const stats = shareStats(member);
  const accent = seasonTagColor(member.year);
  const stamp = shareStamp(member);

  const statCell = (s: ShareStat): Node =>
    el(
      // Half the inner width, less the gutter (padding sits outside the width).
      { flexDirection: "column", width: TAG_INNER / 2 - 16, paddingTop: 22, paddingRight: 16 },
      el(
        {
          flexDirection: "column",
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: shareStatFontSize(s),
          lineHeight: 1,
          color: COLORS.ink,
          wordBreak: "break-word",
        },
        ...(s.isName ? splitName(s.value) : [s.value]).map((line) => el({}, line)),
      ),
      el({ fontFamily: BODY, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6 }, s.label),
    );

  return el(
    { width: SHARE_IMAGE_SIZE, height: SHARE_IMAGE_SIZE, backgroundColor: COLORS.night, position: "relative" },
    el(
      {
        position: "absolute",
        left: TAG.left,
        top: TAG.top,
        width: TAG.width,
        height: TAG.height,
        borderRadius: TAG.radius,
        backgroundColor: COLORS.tag,
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
      },
      el(
        {
          width: TAG.width,
          height: TAG.band - (HOLE.y - TAG.top - HOLE.r),
          paddingTop: HOLE.y - TAG.top - HOLE.r,
          backgroundColor: accent,
          justifyContent: "center",
          position: "relative",
        },
        el(
          {
            position: "absolute",
            left: TAG.padX,
            top: 0,
            height: TAG.band,
            alignItems: "center",
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: 64,
            color: COLORS.white,
          },
          String(member.year),
        ),
        el({
          // Border sits outside width/height in satori: 2r across in all.
          width: (HOLE.r - HOLE.ring) * 2,
          height: (HOLE.r - HOLE.ring) * 2,
          borderRadius: 999,
          // The strap, seen through the hole.
          backgroundColor: TAG_STRAP_COLORS.inHole,
          border: `${HOLE.ring}px solid ${TAG_STRAP_COLORS.ring}`,
        }),
      ),
      el(
        {
          flexDirection: "column",
          width: TAG_INNER,
          height: TAG.height - TAG.band - TAG.padTop - TAG.padBottom,
          paddingLeft: TAG.padX,
          paddingTop: TAG.padTop,
          paddingBottom: TAG.padBottom,
        },
        img(loadLogo(), 266, 70),
        el(
          { alignItems: "center", gap: AVATAR.gap, marginTop: 32 },
          avatar(member, accent, photo),
          el(
            {
              flexDirection: "column",
              width: NAME_WIDTH,
              fontFamily: DISPLAY,
              fontWeight: 900,
              fontSize: shareNameFontSize(member.displayName),
              lineHeight: 0.86,
              textTransform: "uppercase",
              color: COLORS.night,
              wordBreak: "break-word",
            },
            ...splitName(member.displayName).map((line) => el({}, line)),
          ),
        ),
        el({ flexWrap: "wrap", marginTop: "auto" }, ...stats.map(statCell)),
      ),
      stitching(),
      ...(stamp ? [seal(stamp, member.year)] : []),
    ),
    img(strap(), TAG.width, STRAP_HEIGHT, { position: "absolute", left: TAG.left, top: 0 }),
  );
}

/** Renders the member's share card to a PNG. */
export async function renderShareImage(member: SeasonWrappedMember, photo?: string): Promise<Buffer> {
  const svg = await satori(buildShareImageTree(member, photo) as unknown as Parameters<typeof satori>[0], {
    width: SHARE_IMAGE_SIZE,
    height: SHARE_IMAGE_SIZE,
    fonts: loadFonts(),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: SHARE_IMAGE_SIZE } }).render();
  return png.asPng();
}
