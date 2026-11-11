/** Longest side of an avatar before upload. The server crops to 400px afterwards. */
export const AVATAR_UPLOAD_MAX_DIMENSION = 1200;

/** Must stay below the 5MB limit on `avatars/` in `storage.rules`. */
export const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const JPEG_QUALITY = 0.85;

/**
 * Shrinks a photo so its longest side is at most `maxDimension`, re-encoded as
 * JPEG. Phone photos are often 5MB+, which `storage.rules` rejects (reported
 * as `storage/unauthorized`). Returns the original file when it is already
 * small enough, is a GIF (keeps animation), or can't be decoded here.
 */
export async function downscaleImage(
  file: File,
  maxDimension = AVATAR_UPLOAD_MAX_DIMENSION,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < AVATAR_MAX_UPLOAD_BYTES) return file;

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG has no transparency; without a fill, transparent PNG areas turn black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^/.]+$/, "") || "avatar";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
