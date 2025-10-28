/**
 * GHIN API Integration
 * Documentation: https://app.swaggerhub.com/apis-docs/GHIN/Admin/1.0
 */

const GHIN_API_BASE = "https://api2.ghin.com/api/v1";

export interface GHINScore {
  score: number;
  courseRating: number;
  slopeRating: number;
  adjustedGrossScore: number;
  scoreDifferential: number;
  playedAt: string; // ISO date string
  courseName: string;
  courseId?: string;
  teeSet?: string;
  holes?: number; // 9 or 18
  type?: string; // e.g., "Home", "Away", "Tournament"
  revisionScore?: boolean;
}

export interface GHINGolfer {
  ghinNumber: string;
  firstName: string;
  lastName: string;
  handicapIndex?: number;
  lowHandicapIndex?: number;
  clubName?: string;
}

export interface GHINSearchParams {
  golferId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  limit?: number;
  offset?: number;
  statuses?: string; // e.g., "Validated"
  cookie?: string; // GHIN session cookie
}

/**
 * Get golfer information
 */
export async function getGolferInfo(
  golferId: string
): Promise<GHINGolfer | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await fetch(`${GHIN_API_BASE}/golfers/${golferId}.json`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch golfer info:",
        response.statusText,
        response.status
      );
      const text = await response.text();
      console.error("Response:", text.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching golfer info:", error);
    return null;
  }
}

/**
 * Get golfer's scores with flexible filtering
 * Uses a Firebase Cloud Function proxy to send the cookie header
 * @param params - Search parameters including golfer ID, date range, limit, etc.
 */
export async function getGolferScores(
  params: GHINSearchParams
): Promise<GHINScore[]> {
  try {
    // If no cookie provided, try direct API call (will likely fail)
    if (!params.cookie) {
      console.warn("No cookie provided, GHIN API may reject request");
    }

    // Use Firebase Cloud Function proxy to handle cookie header
    const functionUrl =
      "https://us-central1-ridgefield-golf-club.cloudfunctions.net/ghinProxy";

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        golferId: params.golferId,
        startDate: params.startDate,
        endDate: params.endDate,
        limit: params.limit,
        offset: params.offset,
        statuses: params.statuses,
        cookie: params.cookie,
      }),
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch scores:",
        response.statusText,
        response.status
      );
      const text = await response.text();
      console.error("Response:", text.substring(0, 200));
      return [];
    }

    const data = await response.json();
    return data.scores || data || [];
  } catch (error) {
    console.error("Error fetching scores:", error);
    return [];
  }
}

/**
 * @deprecated Use getGolferScores instead
 * Search historical scores with filters
 */
export async function searchScores(
  params: GHINSearchParams
): Promise<GHINScore[]> {
  return getGolferScores(params);
}
