import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  getMetadata,
  StorageReference,
} from "firebase/storage";
import { storage, auth } from "@/config/firebase";

/**
 * Uploads a File to storage under `avatars/{uid}/{filename}` and returns the download URL.
 */
export async function uploadProfilePicture(
  uid: string,
  file: File
): Promise<string> {
  // Runtime sanity checks & debug logging to help diagnose permission issues.
  try {
    // eslint-disable-next-line no-console
    console.debug(
      "uploadProfilePicture: current auth uid=",
      auth.currentUser?.uid
    );
  } catch {
    // ignore
  }

  if (!auth.currentUser) {
    throw new Error(
      "Cannot upload avatar: no authenticated user (auth.currentUser is null)."
    );
  }

  if (auth.currentUser.uid !== uid) {
    throw new Error(
      `Cannot upload avatar: authenticated UID (${auth.currentUser.uid}) does not match target uid (${uid}).`
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

/**
 * Uploads a blog featured image to storage under `blog-images/{filename}` and returns the download URL.
 * Only admins can upload blog images.
 * Sets aggressive cache headers for optimal performance (1 year cache).
 * @param file - The image file to upload
 * @param customFilename - Optional custom filename (without extension). If not provided, uses original filename.
 */
export async function uploadBlogImage(
  file: File,
  customFilename?: string
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error(
      "Cannot upload blog image: no authenticated user (auth.currentUser is null)."
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
      } catch (error) {
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
    })
  );

  // Sort by upload date, newest first
  return images.sort((a, b) => b.uploadedAt - a.uploadedAt);
}
