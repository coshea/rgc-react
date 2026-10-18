import { createHash } from "node:crypto";

/**
 * Resend batch sending (POST /emails/batch).
 *
 * - Up to 100 emails per request; each email gets its own `to`, so members
 *   never see each other's addresses.
 * - Each chunk carries an `Idempotency-Key` derived from its content. Resend
 *   remembers keys for 24h, so a retried or re-run chunk with the same
 *   recipients is not delivered twice.
 * - The team rate limit is 10 req/s. 429 and 5xx responses are retried,
 *   honouring the `retry-after` header.
 */

export const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
export const RESEND_BATCH_LIMIT = 100;
const MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10_000;

export interface ResendTag {
  /** ASCII letters, numbers, underscores or dashes only. */
  name: string;
  value: string;
}

export interface ResendBatchEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  /** Plain-text alternative to `html`. */
  text?: string;
  headers?: Record<string, string>;
  tags?: ResendTag[];
}

export interface ResendBatchOptions {
  /** Prefix for the per-chunk idempotency key, e.g. `registration-opening/<id>`. */
  idempotencyPrefix: string;
  /** Injected for tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ResendBatchResult {
  sent: number;
  failed: number;
  /** Positions in the input `emails` of the ones that were not sent. */
  failedIndices: number[];
}

export class ResendApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`Resend API error ${status}${code ? ` (${code})` : ""}`);
    this.name = "ResendApiError";
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Stable key for one chunk: same prefix + recipients => same key. */
export function buildChunkIdempotencyKey(
  prefix: string,
  emails: readonly ResendBatchEmail[],
): string {
  const recipients = emails
    .flatMap((email) => email.to)
    .map((to) => to.toLowerCase())
    .sort()
    .join(",");
  const digest = createHash("sha256")
    .update(recipients)
    .digest("hex")
    .slice(0, 32);
  // Resend allows up to 256 characters.
  return `${prefix.slice(0, 200)}/${digest}`;
}

function retryDelayMs(response: Response, attempt: number): number {
  const header = Number(response.headers.get("retry-after"));
  const fromHeader = Number.isFinite(header) && header > 0 ? header * 1000 : 0;
  const backoff = DEFAULT_RETRY_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(Math.max(fromHeader, backoff), MAX_RETRY_DELAY_MS);
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await response.text());
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (typeof record.name === "string") return record.name;
      if (typeof record.code === "string") return record.code;
    }
  } catch {
    // Fall back to a status-only error.
  }
  return undefined;
}

async function postChunk(
  apiKey: string,
  emails: ResendBatchEmail[],
  idempotencyKey: string,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(emails),
    });

    if (response.ok) return;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS) {
      throw new ResendApiError(response.status, await readErrorCode(response));
    }

    await sleep(retryDelayMs(response, attempt));
  }
}

/**
 * Sends emails in chunks of 100. A chunk that still fails after retries is
 * counted as failed and the remaining chunks are still attempted. Throws only
 * when every chunk failed, so callers can tell a partial send from an outage.
 */
export async function sendResendBatch(
  apiKey: string,
  emails: readonly ResendBatchEmail[],
  options: ResendBatchOptions,
): Promise<ResendBatchResult> {
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let sent = 0;
  let failed = 0;
  const failedIndices: number[] = [];
  let lastError: unknown;

  for (const [chunkIndex, emailsChunk] of chunk(
    emails,
    RESEND_BATCH_LIMIT,
  ).entries()) {
    try {
      await postChunk(
        apiKey,
        emailsChunk,
        buildChunkIdempotencyKey(options.idempotencyPrefix, emailsChunk),
        sleep,
      );
      sent += emailsChunk.length;
    } catch (error) {
      failed += emailsChunk.length;
      const start = chunkIndex * RESEND_BATCH_LIMIT;
      for (let i = 0; i < emailsChunk.length; i++) failedIndices.push(start + i);
      lastError = error;
    }
  }

  if (sent === 0 && failed > 0) {
    throw lastError;
  }

  return { sent, failed, failedIndices };
}
