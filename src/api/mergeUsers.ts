// API for merging duplicate user records
// This calls a Firebase Cloud Function that consolidates data from an existing user into a new user

/**
 * Merge user data from existingUserId into newUserId.
 * The function will update all championships and tournament references.
 *
 * @param newUserId - The user ID to keep (target of the merge)
 * @param existingUserId - The user ID to merge from (will be marked as merged)
 * @param idToken - Firebase auth token for authorization
 * @returns Statistics about updated records
 */
export async function mergeUserIds(
  newUserId: string,
  existingUserId: string,
  idToken: string
): Promise<{ championshipsUpdated: number; tournamentsUpdated: number }> {
  const endpoint =
    "https://us-central1-ridgefield-golf-club.cloudfunctions.net/merge_user_ids";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ newUserId, existingUserId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error ?? `merge_user_ids failed (${response.status})`
    );
  }

  const data = await response.json();
  return {
    championshipsUpdated: data.championshipsUpdated ?? 0,
    tournamentsUpdated: data.tournamentsUpdated ?? 0,
  };
}
