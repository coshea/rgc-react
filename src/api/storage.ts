import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
  StorageReference,
} from "firebase/storage";
import { storage, auth } from "@/config/firebase";

async function resizeProfileImage(file: File, maxDimension = 400): Promise<Blob> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for resizing."));
      img.src = objectUrl;
    });

    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to generate resized avatar."));
            return;
          }
          resolve(blob);
        },
        outputType,
        outputType === "image/jpeg" ? 0.82 : undefined,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Uploads a File to storage under `avatars/{uid}/{filename}` and returns the download URL.
 */
export async function uploadProfilePicture(
  uid: string,
  file: File,
): Promise<string> {
  // Runtime sanity checks & debug logging to help diagnose permission issues.
  try {
    // eslint-disable-next-line no-console
    console.debug(
      "uploadProfilePicture: current auth uid=",
      auth.currentUser?.uid,
    );
  } catch {
    // ignore
  }

  if (!auth.currentUser) {
    throw new Error(
      "Cannot upload avatar: no authenticated user (auth.currentUser is null).",
    );
  }

  if (auth.currentUser.uid !== uid) {
    throw new Error(
      `Cannot upload avatar: authenticated UID (${auth.currentUser.uid}) does not match target uid (${uid}).`,
    );
  }

  const filename = `${Date.now()}_${file.name}`;
  const path = `avatars/${uid}/${filename}`;
  // eslint-disable-next-line no-console
  console.debug("uploadProfilePicture: uploading to", path);

  const storageRef = ref(storage, path);
  // Store upload timestamp in custom metadata for consistency
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedAt: Date.now().toString(),
    },
  });
  const url = await getDownloadURL(snapshot.ref);
  return url;
}

export async function uploadResizedProfilePicture(
  uid: string,
  file: File,
): Promise<{ photoURL: string; profileURL: string }> {
  const photoURL = await uploadProfilePicture(uid, file);

  if (!file.type.startsWith("image/")) {
    return { photoURL, profileURL: photoURL };
  }

  try {
    const resizedBlob = await resizeProfileImage(file);
    const baseName = file.name.replace(/\.[^/.]+$/, "") || "avatar";
    const extension = resizedBlob.type === "image/png" ? "png" : "jpg";
    const path = `avatars/${uid}/resized/${Date.now()}_${baseName}.${extension}`;

    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, resizedBlob, {
      contentType: resizedBlob.type || "image/jpeg",
      customMetadata: {
        uploadedAt: Date.now().toString(),
        resized: "true",
        sourceFile: file.name,
      },
    });

    const profileURL = await getDownloadURL(snapshot.ref);
    return { photoURL, profileURL };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "uploadResizedProfilePicture: failed to generate resized avatar; falling back to original file",
      error,
    );
    return { photoURL, profileURL: photoURL };
  }
}

/**
 * Uploads a blog featured image to storage under `blog-images/{filename}` and returns the download URL.
 * Only admins can upload blog images.
 * Sets aggressive cache headers for optimal performance (1 year cache).
 * @param file - The image file to upload
 * @param customFilename - Optional custom filename (without extension). If not provided, uses original filename.
 */
export async function uploadBlogImage(
  file: File,
  customFilename?: string,
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error(
      "Cannot upload blog image: no authenticated user (auth.currentUser is null).",
    );
  }

  // Get file extension
  const extension = file.name.split(".").pop() || "jpg";

  // Use custom filename if provided, otherwise use original filename
  const baseName = customFilename
    ? customFilename.replace(/\s+/g, "_")
    : file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_");

  const filename = `${Date.now()}_${baseName}.${extension}`;
  const path = `blog-images/${filename}`;

  const storageRef = ref(storage, path);

  // Upload with cache control metadata for browser caching
  // public,max-age=31536000 = cache for 1 year (images are immutable due to timestamp in filename)
  // Store upload timestamp in custom metadata for robust sorting
  const snapshot = await uploadBytes(storageRef, file, {
    cacheControl: "public,max-age=31536000,immutable",
    contentType: file.type,
    customMetadata: {
      uploadedAt: Date.now().toString(),
    },
  });

  const url = await getDownloadURL(snapshot.ref);
  return url;
}

/**
 * Lists all previously uploaded blog images.
 * Returns an array of objects containing the image name and download URL.
 * Uses custom metadata for robust timestamp retrieval instead of parsing filenames.
 */
export async function listBlogImages(): Promise<
  Array<{ name: string; url: string; uploadedAt: number }>
> {
  if (!auth.currentUser) {
    return [];
  }

  const blogImagesRef = ref(storage, "blog-images");
  const result = await listAll(blogImagesRef);

  const images = await Promise.all(
    result.items.map(async (itemRef: StorageReference) => {
      const url = await getDownloadURL(itemRef);

      // Retrieve upload timestamp from custom metadata
      let uploadedAt = 0;
      try {
        const metadata = await getMetadata(itemRef);
        if (metadata.customMetadata?.uploadedAt) {
          uploadedAt = parseInt(metadata.customMetadata.uploadedAt);
        }
      } catch {
        // Fallback: extract timestamp from filename for backwards compatibility
        // (format: timestamp_originalname)
        const match = itemRef.name.match(/^(\d+)_/);
        uploadedAt = match ? parseInt(match[1]) : 0;
      }

      return {
        name: itemRef.name,
        url,
        uploadedAt,
      };
    }),
  );

  // Sort by upload date, newest first
  return images.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/**
 * Lists documents available in storage under `public-docs`.
 * Returns an array of objects containing the doc name and download URL.
 */
export async function listPublicDocs(): Promise<
  Array<{ name: string; url: string }>
> {
  if (!auth.currentUser) {
    return [];
  }

  const docsRef = ref(storage, "public-docs");
  const result = await listAll(docsRef);

  const docs = await Promise.all(
    result.items.map(async (itemRef: StorageReference) => {
      const url = await getDownloadURL(itemRef);
      return {
        name: itemRef.name,
        url,
      };
    }),
  );

  return docs.sort((a, b) => a.name.localeCompare(b.name));
}
