import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

const GHIN_API_BASE = "https://api2.ghin.com/api/v1";

/**
 * Proxy function for GHIN API requests
 * This is needed because browsers don't allow setting Cookie headers directly
 */
export const ghinProxy = onRequest(
  {cors: true, maxInstances: 10},
  async (request, response) => {
    // Only allow POST requests
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const {golferId, startDate, endDate, limit, offset, statuses, cookie} =
        request.body;

      if (!golferId) {
        response.status(400).send("Missing golfer_id");
        return;
      }

      if (!cookie) {
        response.status(400).send("Missing cookie");
        return;
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("golfer_id", golferId);
      if (startDate) queryParams.append("from_date_played", startDate);
      if (endDate) queryParams.append("to_date_played", endDate);
      if (limit) queryParams.append("limit", limit.toString());
      if (offset !== undefined) queryParams.append("offset", offset.toString());
      if (statuses) queryParams.append("statuses", statuses);

      const url = `${GHIN_API_BASE}/scores.json?${queryParams.toString()}`;

      logger.info("Fetching GHIN scores", {golferId, url});

      // Make request to GHIN API with cookie
      const ghinResponse = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Cookie": `GHIN2020_api2_production=${cookie}`,
        },
      });

      if (!ghinResponse.ok) {
        const errorText = await ghinResponse.text();
        logger.error("GHIN API error", {
          status: ghinResponse.status,
          error: errorText,
        });
        response.status(ghinResponse.status).send({
          error: "GHIN API request failed",
          details: errorText.substring(0, 200),
        });
        return;
      }

      const data = await ghinResponse.json();
      response.status(200).json(data);
    } catch (error) {
      logger.error("Error proxying GHIN request", error);
      response.status(500).send({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);
