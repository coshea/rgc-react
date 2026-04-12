import * as path from "path";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import { z } from "zod";

enableFirebaseTelemetry();

export const GOOGLE_GENAI_API_KEY = defineSecret("GOOGLE_GENAI_API_KEY");

// Lazily initialized so the secret env var is available at first request
let _ai: ReturnType<typeof genkit> | null = null;
function getAi() {
  if (!_ai) {
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
  tee: string;
  prizePool: string;
  totalTeams: number;
  weatherDescription: string;
  topThreeFormatted: string;
  closestToPinFormatted: string;
  hasScores: boolean;
}

function weatherPhrase(w: NonNullable<BlogWriteupInput["weather"]>): string {
  const { temperature, condition, windSpeed } = w;
  const tempAdj =
    temperature >= 80
      ? "hot"
      : temperature >= 72
        ? "warm"
        : temperature >= 60
          ? "mild"
          : "cool";
  const windAdj =
    windSpeed <= 5
      ? "calm"
      : windSpeed <= 12
        ? "with a light breeze"
        : windSpeed <= 20
          ? "and breezy"
          : "and quite windy";
  return `${tempAdj}, ${condition.toLowerCase()} day (${temperature}°F, ${windAdj} at ${windSpeed} mph)`;
}

function buildPromptData(input: BlogWriteupInput): PromptData {
  const weatherDescription = input.weather ? weatherPhrase(input.weather) : "";

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
    tee: input.tee,
    prizePool:
      input.prizePool > 0 ? `$${input.prizePool.toLocaleString()}` : "",
    totalTeams: input.totalTeams ?? 0,
    weatherDescription,
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
    if (!adminData?.isAdmin && !adminData?.admin) {
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
