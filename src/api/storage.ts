import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}
