import {
  SEASON_WRAPPED_SOURCE,
  seasonWrappedPath,
  type SeasonWrappedSource,
} from "@@/seasonWrapped/types";

/** Month (0-based, UTC) from which the current year's Wrapped is the default. */
const WRAPPED_SEASON_START_MONTH = 9; // October

/**
 * The season Wrapped is about right now: this year from October, otherwise
 * last year (so the story stays reachable through the winter).
 */
export function defaultWrappedYear(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= WRAPPED_SEASON_START_MONTH ? year : year - 1;
}

/** Where a visit came from, read from the link's `utm_source`. */
export function wrappedSourceFromParams(params: URLSearchParams): SeasonWrappedSource {
  switch (params.get("utm_source")) {
    case "resend":
      return SEASON_WRAPPED_SOURCE.EMAIL;
    case SEASON_WRAPPED_SOURCE.PUSH:
      return SEASON_WRAPPED_SOURCE.PUSH;
    case SEASON_WRAPPED_SOURCE.BANNER:
      return SEASON_WRAPPED_SOURCE.BANNER;
    default:
      return SEASON_WRAPPED_SOURCE.DIRECT;
  }
}

/** Link to a member's story, tagged with where it was opened from. */
export function wrappedLink(year: number, source?: SeasonWrappedSource): string {
  const path = seasonWrappedPath(year);
  return source ? `${path}?utm_source=${source}` : path;
}

/** Admin preview link: never counted as an open. */
export function wrappedPreviewLink(year: number, uid: string): string {
  return `${seasonWrappedPath(year)}?member=${encodeURIComponent(uid)}`;
}
