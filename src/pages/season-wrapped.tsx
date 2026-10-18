import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import * as Sentry from "@sentry/react";

import { recordWrappedView } from "@/api/seasonWrapped";
import { buildCards } from "@/components/season-wrapped/build-cards";
import { WrappedSharePanel } from "@/components/season-wrapped/wrapped-share-panel";
import { WrappedStory } from "@/components/season-wrapped/wrapped-story";
import { siteConfig } from "@/config/site";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useUsersMap } from "@/hooks/useUsers";
import {
  useWrappedSeason,
  useWrappedShareImage,
  useWrappedStory,
} from "@/hooks/useSeasonWrapped";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/utils/admin";
import { AnalyticsEvent, trackEvent } from "@/utils/analytics";
import { wrappedSourceFromParams } from "@/utils/seasonWrapped";
import { SEASON_WRAPPED_STATUS } from "@@/seasonWrapped/types";

/** Cards before the share card at which to start loading the share image. */
const SHARE_IMAGE_PRELOAD_CARDS = 3;

function parseYear(value: string | undefined): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function Message({ title, body }: { title: string; body: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      <Icon icon="lucide:flag" className="h-8 w-8 text-accent" />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted">{body}</p>
      <Button className="mt-2 min-h-11" onPress={() => navigate(siteConfig.pages.home.link)}>
        Back to home
      </Button>
    </div>
  );
}

export default function SeasonWrappedPage() {
  const params = useParams();
  const year = parseYear(params.year);
  usePageTracking(year ? `Season Wrapped ${year}` : "Season Wrapped");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { isAdmin, loadingAdmin } = useAdminFlag(user);

  const memberParam = searchParams.get("member");
  const previewOther = !!memberParam && isAdmin;
  const targetUid = previewOther ? memberParam : user?.uid;
  const source = useMemo(() => wrappedSourceFromParams(searchParams), [searchParams]);

  const ready = !!year && !loading && !loadingAdmin && !!user;
  const seasonQuery = useWrappedSeason(year ?? 0, ready);
  const storyQuery = useWrappedStory(year ?? 0, ready ? targetUid ?? undefined : undefined);
  // Member profiles for avatar photos (partner, podium, champions).
  const { usersMap } = useUsersMap();
  const season = seasonQuery.data;
  const story = storyQuery.data;

  const published = season?.status === SEASON_WRAPPED_STATUS.PUBLISHED;
  // Admin previews (drafts, other members, ?member= links) are never counted.
  const tracking = !!story && !!user && published && !memberParam && story.uid === user.uid;

  const cards = useMemo(() => (season && story ? buildCards(season, story) : []), [season, story]);

  const furthestRecorded = useRef(0);
  const opened = useRef(false);
  const shareIndex = cards.length - 1;
  const [preloadShare, setPreloadShare] = useState(false);

  const record = useCallback(
    (card: number, extra: { newOpen?: boolean; shared?: boolean } = {}) => {
      if (!tracking || !year || !user) return;
      recordWrappedView(year, user.uid, {
        source,
        newOpen: extra.newOpen ?? false,
        card,
        cardCount: cards.length,
        ...(extra.shared ? { shared: true } : {}),
      }).catch((error) => Sentry.captureException(error));
    },
    [tracking, year, user, source, cards.length],
  );

  const shareImage = useWrappedShareImage(year ?? 0, story?.uid, story?.version, {
    asAdmin: previewOther,
    enabled: preloadShare,
  });

  const onCardChange = useCallback(
    (index: number) => {
      if (!year || cards.length === 0) return;
      const card = index + 1;
      if (index >= shareIndex - SHARE_IMAGE_PRELOAD_CARDS) setPreloadShare(true);
      if (!tracking) return;
      trackEvent(AnalyticsEvent.WRAPPED_CARD_VIEW, { year, card, card_id: cards[index].id });
      if (!opened.current) {
        opened.current = true;
        furthestRecorded.current = card;
        trackEvent(AnalyticsEvent.WRAPPED_OPEN, { year, source });
        record(card, { newOpen: true });
      } else if (card > furthestRecorded.current) {
        furthestRecorded.current = card;
        record(card);
      }
    },
    [year, cards, shareIndex, tracking, source, record],
  );

  const onShared = useCallback(
    (method: "share_sheet" | "download") => {
      if (!tracking || !year) return;
      trackEvent(AnalyticsEvent.WRAPPED_SHARE, { year, method });
      record(cards.length, { shared: true });
    },
    [tracking, year, record, cards.length],
  );

  if (!year) {
    return <Message title="Season not found" body="That link doesn't point to a season." />;
  }
  if (!ready || seasonQuery.isLoading || storyQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" aria-label="Loading your season" />
      </div>
    );
  }
  if (seasonQuery.isError || storyQuery.isError) {
    return <Message title="Something went wrong" body="We couldn't load this season. Try again in a minute." />;
  }
  if (!season || !story) {
    return (
      <Message
        title={`Your ${year} season isn't ready yet`}
        body="Season Wrapped is for members who paid for the year or played in a club event. Check back once the club announces it."
      />
    );
  }

  return (
    <div className="px-2 py-4 sm:px-4 sm:py-8">
      {(memberParam || !published) && (
        <div className="mx-auto mb-3 flex max-w-[420px] flex-wrap items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Chip size="sm" color={published ? "success" : "warning"} variant="soft">
            {published ? "Published" : "Draft"}
          </Chip>
          <span className="min-w-0 flex-1">
            Preview of {story.uid === user?.uid ? "your" : `${story.displayName}'s`} story. Opens aren&apos;t counted.
          </span>
          {isAdmin && (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => navigate(`${siteConfig.pages.adminDashboard.link}?tab=wrapped`)}
            >
              Back to admin
            </Button>
          )}
        </div>
      )}
      <WrappedStory
        season={season}
        story={story}
        cards={cards}
        usersById={usersMap}
        onCardChange={onCardChange}
        shareSlot={
          <WrappedSharePanel
            year={year}
            image={shareImage.data}
            isLoading={shareImage.isFetching}
            isError={shareImage.isError}
            onShared={onShared}
          />
        }
      />
    </div>
  );
}
