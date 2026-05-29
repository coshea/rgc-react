import * as path from "path";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import { z } from "zod";
import { logger } from "./logger";

export const GOOGLE_GENAI_API_KEY = defineSecret("GOOGLE_GENAI_API_KEY");

// Lazily initialized so the secret env var is available at first request
let _ai: ReturnType<typeof genkit> | null = null;
let telemetryAttempted = false;

function ensureFirebaseTelemetry() {
  if (telemetryAttempted) {
    return;
  }

  telemetryAttempted = true;

  try {
    enableFirebaseTelemetry();
  } catch (error) {
    logger.warn("generate_blog_writeup: firebase telemetry disabled", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function getAi() {
  if (!_ai) {
    ensureFirebaseTelemetry();
    _ai = genkit({
      plugins: [googleAI()],
      // __dirname is /workspace/lib at runtime; prompts live at /workspace/prompts
      promptDir: path.join(__dirname, "..", "prompts"),
    });
  }
  return _ai;
}

const CompetitorSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
});

const WinnerPlaceSchema = z.object({
  place: z.number(),
  competitors: z.array(CompetitorSchema),
  prizeAmount: z.number().optional(),
  score: z.string().optional(),
});

const WinnerGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string(),
  order: z.number(),
  winners: z.array(WinnerPlaceSchema),
});

const InputSchema = z.object({
  tournamentTitle: z.string(),
  date: z.string(),
  description: z.string().optional(),
  format: z.string().optional(),
  tee: z.string(),
  prizePool: z.number(),
  totalTeams: z.number().optional(),
  winnerGroups: z.array(WinnerGroupSchema),
  weather: z
    .object({
      condition: z.string(),
      temperature: z.number(),
      windSpeed: z.number(),
      precipitation: z.number(),
      humidity: z.number(),
    })
    .optional(),
});

type BlogWriteupInput = z.infer<typeof InputSchema>;

interface PromptData {
  tournamentTitle: string;
  date: string;
  description: string;
  tee: string;
  prizePool: string;
  totalTeams: number;
  weatherFacts: string;
  topThreeFormatted: string;
  closestToPinFormatted: string;
  hasScores: boolean;
}

function weatherFacts(w: NonNullable<BlogWriteupInput["weather"]>): string {
  const { temperature, condition, windSpeed, precipitation } = w;
  const parts = [
    `${temperature}°F`,
    condition,
    windSpeed <= 3
      ? "calm winds"
      : windSpeed <= 12
        ? `light breeze (~${windSpeed} mph)`
        : windSpeed <= 20
          ? `steady breeze (~${windSpeed} mph)`
          : `gusty winds (~${windSpeed} mph)`,
  ];
  if (precipitation > 0) parts.push(`${precipitation}" of rain`);
  return parts.join(", ");
}

function buildPromptData(input: BlogWriteupInput): PromptData {
  const weatherFactsStr = input.weather ? weatherFacts(input.weather) : "";

  // Top 3 from the first overall group
  const overallGroup = input.winnerGroups
    .filter((g) => g.type === "overall")
    .sort((a, b) => a.order - b.order)[0];

  let topThreeFormatted = "";
  let hasScores = false;

  if (overallGroup) {
    const top3 = overallGroup.winners
      .slice()
      .sort((a, b) => a.place - b.place)
      .slice(0, 3);

    hasScores = top3.some((p) => !!p.score);

    const placeLabel = (n: number) =>
      n === 1 ? "1st Place" : n === 2 ? "2nd Place" : "3rd Place";

    topThreeFormatted = top3
      .map((p) => {
        const names = p.competitors.map((c) => c.displayName).join(" & ");
        const score = p.score ? ` (${p.score})` : "";
        const prize = p.prizeAmount
          ? ` — $${p.prizeAmount.toLocaleString()}`
          : "";
        return `${placeLabel(p.place)}: ${names}${score}${prize}`;
      })
      .join("\n");
  }

  // Closest to pin groups
  const closestToPinFormatted = input.winnerGroups
    .filter((g) => g.type === "closestToPin")
    .sort((a, b) => a.order - b.order)
    .map((group) => {
      const winner = group.winners[0];
      if (!winner) return "";
      const names = winner.competitors.map((c) => c.displayName).join(" & ");
      return `${group.label}: ${names}`;
    })
    .filter(Boolean)
    .join("\n");

  return {
    tournamentTitle: input.tournamentTitle,
    date: input.date,
    description: input.description ?? "",
    tee: input.tee,
    prizePool:
      input.prizePool > 0 ? `$${input.prizePool.toLocaleString()}` : "",
    totalTeams: input.totalTeams ?? 0,
    weatherFacts: weatherFactsStr,
    topThreeFormatted,
    closestToPinFormatted,
    hasScores,
  };
}

/**
 * Admin-only callable function that generates an AI tournament blog write-up
 * using Google Gemini via Genkit + the blog-writeup.prompt Dotprompt file.
 *
 * Requires a Cloud Secret named GOOGLE_GENAI_API_KEY.
 */
export const generate_blog_writeup = onCall(
  { secrets: [GOOGLE_GENAI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    // Admin-only: verify against admin doc (matches app admin detection pattern)
    const adminDoc = await admin
      .firestore()
      .doc(`admin/${request.auth.uid}`)
      .get();
    const adminData = adminDoc.data();
    if (
      adminData?.isAdmin !== true &&
      adminData?.admin !== true &&
      adminData?.admin !== "true"
    ) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const parsed = InputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.message}`,
      );
    }

    const ai = getAi();
    const writeupPrompt = ai.prompt("blog-writeup");
    const result = await writeupPrompt(buildPromptData(parsed.data));

    return { content: result.text };
  },
);
