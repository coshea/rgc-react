import * as admin from "firebase-admin";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import sharp from "sharp";

import { logger } from "./logger";

const MAX_PROFILE_DIMENSION = 400;
const AVATAR_PATH_PREFIX = "avatars/";

function getUserUidFromAvatarPath(filePath: string): string | null {
  const parts = filePath.split("/");
  if (parts.length < 3 || parts[0] !== "avatars") {
    return null;
  }

  const uid = parts[1]?.trim();
  return uid || null;
}

export const resize_user_avatar = onObjectFinalized(
  {
    region: "us-central1",
    cpu: 1,
    timeoutSeconds: 60,
    memory: "1GiB",
  },
  async (event) => {
    const filePath = event.data?.name;
    const bucketName = event.data?.bucket;
    const contentType = event.data?.contentType ?? "";

    if (!filePath || !bucketName) {
      return;
    }

    if (!filePath.startsWith(AVATAR_PATH_PREFIX) || filePath.includes("/resized/")) {
      return;
    }

    if (!contentType.startsWith("image/")) {
      return;
    }

    const uid = getUserUidFromAvatarPath(filePath);
    if (!uid) {
      logger.warn("resize_user_avatar: skipped upload without valid user uid", {
        filePath,
      });
      return;
    }

    const bucket = admin.storage().bucket(bucketName);
    const sourceFile = bucket.file(filePath);

    try {
      const [sourceBuffer] = await sourceFile.download();
      const metadata = await sharp(sourceBuffer).metadata();
      const largestDimension = Math.max(metadata.width ?? 0, metadata.height ?? 0);

      if (largestDimension <= MAX_PROFILE_DIMENSION) {
        return;
      }

      const outputFilename = filePath
        .split("/")
        .slice(2)
        .join("/")
        .replace(/\.[^/.]+$/, ".jpg");

      const resizedBuffer = await sharp(sourceBuffer)
        .resize(MAX_PROFILE_DIMENSION, MAX_PROFILE_DIMENSION, {
          fit: "cover",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toBuffer();

      const resizedPath = `avatars/${uid}/resized/${outputFilename}`;
      const destinationFile = bucket.file(resizedPath);

      await destinationFile.save(resizedBuffer, {
        contentType: "image/jpeg",
        metadata: {
          cacheControl: "public,max-age=31536000,immutable",
          contentDisposition: "inline",
        },
      });

      const [profileUrl] = await destinationFile.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });

      await admin
        .firestore()
        .doc(`users/${uid}`)
        .set(
          {
            profileURL: profileUrl,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      logger.info("resize_user_avatar: generated resized profile", {
        uid,
        sourcePath: filePath,
        resizedPath,
      });
    } catch (error) {
      logger.error("resize_user_avatar: failed to resize profile upload", {
        uid,
        filePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);
