import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase";

/**
 * Uploads a File to storage under `avatars/{uid}/{filename}` and returns the download URL.
 */
export async function uploadProfilePicture(
  uid: string,
  file: File
): Promise<string> {
  const storageRef = ref(storage, `avatars/${uid}/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}
