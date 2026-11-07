import * as admin from "firebase-admin";
import sharp from "sharp";

import { logger } from "../logger";

/** Square size the photo is cropped to; the tag shows it at 138px. */
const PHOTO_SIZE = 276;
const FETCH_TIMEOUT_MS = 5000;
/** Avatars are resized on upload; anything bigger isn't a profile photo. */
const MAX_BYTES = 8 * 1024 * 1024;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * The member's profile photo for the share tag, as a JPEG data URI, in the
 * same order the site's UserAvatar uses: `profileURL`, then `photoURL`.
 * Returns undefined (the tag shows initials) when there's no photo or it
 * can't be loaded; a bad photo never fails the share image.
 */
export async function loadSharePhoto(uid: string): Promise<string | undefined> {
  let url: string | undefined;
  try {
    const user = (await admin.firestore().doc(`users/${uid}`).get()).data() ?? {};
    url = str(user.profileURL) ?? str(user.photoURL);
    if (!url) return undefined;

    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) throw new Error(`photo too large (${bytes.length} bytes)`);

    // Normalizes webp/heic/etc. (satori reads only png and jpeg) and crops to a square.
    const jpeg = await sharp(bytes)
      .rotate()
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (error) {
    logger.warn("season wrapped: share photo unavailable, using initials", {
      uid,
      hasUrl: !!url,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
