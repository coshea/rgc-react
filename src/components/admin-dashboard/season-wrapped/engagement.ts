import type { WrappedAdminRow } from "@/api/seasonWrapped";
import {
  SEASON_WRAPPED_SOURCE,
  type SeasonWrappedSource,
} from "@@/seasonWrapped/types";

export interface EngagementSummary {
  members: number;
  opened: number;
  finished: number;
  shared: number;
  emailSent: number;
  appSent: number;
  emailClicked: number;
  /** Total opens per source (a member can open more than once). */
  opensBySource: Record<SeasonWrappedSource, number>;
}

export function summarizeEngagement(rows: readonly WrappedAdminRow[]): EngagementSummary {
  const opensBySource: Record<SeasonWrappedSource, number> = {
    [SEASON_WRAPPED_SOURCE.EMAIL]: 0,
    [SEASON_WRAPPED_SOURCE.PUSH]: 0,
    [SEASON_WRAPPED_SOURCE.BANNER]: 0,
    [SEASON_WRAPPED_SOURCE.DIRECT]: 0,
  };
  const summary: EngagementSummary = {
    members: rows.length,
    opened: 0,
    finished: 0,
    shared: 0,
    emailSent: 0,
    appSent: 0,
    emailClicked: 0,
    opensBySource,
  };
  for (const { view, delivery } of rows) {
    if (view && view.openCount > 0) summary.opened++;
    if (view?.completed) summary.finished++;
    if (view?.shared) summary.shared++;
    if (delivery?.emailSentAt) summary.emailSent++;
    if (delivery?.appSentAt) summary.appSent++;
    if ((delivery?.emailClicks ?? 0) > 0) summary.emailClicked++;
    for (const [source, count] of Object.entries(view?.sources ?? {})) {
      if (source in opensBySource) opensBySource[source as SeasonWrappedSource] += count ?? 0;
    }
  }
  return summary;
}

export const ENGAGEMENT_FILTER = {
  ALL: "all",
  NOT_OPENED: "not-opened",
  OPENED: "opened",
  FINISHED: "finished",
  SHARED: "shared",
  NOT_SENT: "not-sent",
} as const;

export type EngagementFilter = (typeof ENGAGEMENT_FILTER)[keyof typeof ENGAGEMENT_FILTER];

export function matchesFilter(row: WrappedAdminRow, filter: EngagementFilter): boolean {
  const opened = (row.view?.openCount ?? 0) > 0;
  switch (filter) {
    case ENGAGEMENT_FILTER.NOT_OPENED:
      return !opened;
    case ENGAGEMENT_FILTER.OPENED:
      return opened;
    case ENGAGEMENT_FILTER.FINISHED:
      return row.view?.completed === true;
    case ENGAGEMENT_FILTER.SHARED:
      return row.view?.shared === true;
    case ENGAGEMENT_FILTER.NOT_SENT:
      return !row.delivery?.emailSentAt && !row.delivery?.appSentAt;
    default:
      return true;
  }
}

export function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}
