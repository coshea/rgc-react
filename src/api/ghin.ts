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
  count?: number;
}

/**
 * Get golfer information
 */
export async function getGolferInfo(
  golferId: string,
  token?: string
): Promise<GHINGolfer | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

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
 * Get golfer's recent scores
 * @param golferId - GHIN golfer ID
 * @param count - Number of scores to retrieve (default: 20)
 */
export async function getGolferScores(
  golferId: string,
  count: number = 20,
  token?: string
): Promise<GHINScore[]> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(
      `${GHIN_API_BASE}/golfers/${golferId}/scores.json?count=${count}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch scores:",
        response.statusText,
        response.status
      );
      // Try to read the response text to see what we're getting
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
 * Search historical scores with filters
 */
export async function searchScores(
  params: GHINSearchParams
): Promise<GHINScore[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    if (params.count) queryParams.append("count", params.count.toString());

    const url = `${GHIN_API_BASE}/scores/search.json?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to search scores:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.scores || [];
  } catch (error) {
    console.error("Error searching scores:", error);
    return [];
  }
}

/**
 * Login to GHIN (if authentication is required for certain endpoints)
 * Note: The public API may not require authentication for basic score viewing
 */
export async function loginToGHIN(
  email: string,
  password: string
): Promise<{ token?: string; error?: string }> {
  try {
    const response = await fetch(`${GHIN_API_BASE}/users/login.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        user: {
          email: email.trim(),
          password: password,
          remember_me: true,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Login failed:", response.status, data);
      return {
        error:
          data.error ||
          data.message ||
          "Login failed. Please check your credentials.",
      };
    }

    // GHIN API typically returns the token in various formats
    const token = data.golfer_user?.token || data.token || data.auth_token;

    if (!token) {
      console.error("No token in response:", data);
      return { error: "Login succeeded but no token received" };
    }

    return { token };
  } catch (error) {
    console.error("Error logging in:", error);
    return { error: "An error occurred during login" };
  }
}

/**
 * Logout from GHIN
 */
export async function logoutFromGHIN(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GHIN_API_BASE}/users/logout.json`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Error logging out:", error);
    return false;
  }
}
