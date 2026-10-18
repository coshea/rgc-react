import { Link } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useWrappedSeason, useWrappedStory } from "@/hooks/useSeasonWrapped";
import { useAuth } from "@/providers/AuthProvider";
import { defaultWrappedYear, wrappedLink } from "@/utils/seasonWrapped";
import {
  SEASON_WRAPPED_SOURCE,
  SEASON_WRAPPED_STATUS,
} from "@@/seasonWrapped/types";
import "@/components/season-wrapped/wrapped.css";

/** Home page invite to the member's story, once the season is published. */
export function WrappedBanner() {
  const { user, loading } = useAuth();
  const year = defaultWrappedYear();
  const signedIn = !loading && !!user;
  const season = useWrappedSeason(year, signedIn);
  const published = season.data?.status === SEASON_WRAPPED_STATUS.PUBLISHED;
  const story = useWrappedStory(year, signedIn && published ? user?.uid : undefined);

  if (!published || !story.data) return null;

  return (
    <section className="wrapped-root w-full max-w-6xl px-4 pt-6">
      <Link
        to={wrappedLink(year, SEASON_WRAPPED_SOURCE.BANNER)}
        className="wr-banner group flex min-h-11 items-center gap-4 overflow-hidden rounded-2xl bg-(--c-night) px-5 py-4 text-(--c-chalk) outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--c-flag)"
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-widest opacity-80">RGC Wrapped</p>
          <p className="wr-big">
            {story.data.firstName}, your {year} season is ready
          </p>
        </div>
        <Icon icon="lucide:arrow-right" className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
