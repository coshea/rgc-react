import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";

import type { User } from "@/api/users";
import type { WrappedCardSpec } from "@/components/season-wrapped/build-cards";
import { WrappedCard, WrappedUsersContext } from "@/components/season-wrapped/wrapped-cards";
import type {
  SeasonWrappedMember,
  SeasonWrappedSeason,
} from "@@/seasonWrapped/types";
import "@/components/season-wrapped/wrapped.css";

const NO_USERS: ReadonlyMap<string, User> = new Map();

interface WrappedStoryProps {
  season: SeasonWrappedSeason;
  story: SeasonWrappedMember;
  cards: WrappedCardSpec[];
  /** Member profiles by uid, for avatar photos. Initials show without it. */
  usersById?: ReadonlyMap<string, User>;
  /** Called with the 0-based index whenever a card comes on screen. */
  onCardChange?: (index: number) => void;
  shareSlot?: ReactNode;
}

/**
 * Tap-through story: tap the right side (or Next / →) to advance, the left
 * side (or Back / ←) to go back.
 */
export function WrappedStory({ season, story, cards, usersById = NO_USERS, onCardChange, shareSlot }: WrappedStoryProps) {
  const [index, setIndex] = useState(0);
  const last = cards.length - 1;
  const current = Math.min(index, last);
  const spec = cards[current];

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.max(0, Math.min(last, i + delta))),
    [last],
  );

  // Fire once per card change, not whenever the parent re-renders.
  const onCardChangeRef = useRef(onCardChange);
  onCardChangeRef.current = onCardChange;
  useEffect(() => {
    onCardChangeRef.current?.(current);
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const isShare = spec.id === "share";

  return (
    <WrappedUsersContext.Provider value={usersById}>
      <div className="wrapped-root flex w-full flex-col items-center gap-3">
        <div
          className="wr-frame"
          aria-roledescription="story"
          aria-label={`Card ${current + 1} of ${cards.length}`}
        >
          <div key={spec.id} className="wr-card-enter absolute inset-0" aria-live="polite">
            <WrappedCard
              spec={spec}
              season={season}
              story={story}
              index={current}
              total={cards.length}
              shareSlot={shareSlot}
            />
          </div>

          {/* Tap zones mirror the Back/Next buttons below; the share card keeps its own buttons tappable. */}
          {!isShare && (
            <>
              <div aria-hidden className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize" onClick={() => go(-1)} />
              <div aria-hidden className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize" onClick={() => go(1)} />
            </>
          )}
        </div>

        <div className="flex w-full max-w-105 items-center justify-between gap-2 px-1">
          <Button variant="tertiary" className="min-h-11" onPress={() => go(-1)} isDisabled={current === 0}>
            <Icon icon="lucide:chevron-left" className="h-4 w-4" />
            Back
          </Button>
          <span className="text-sm text-muted tabular-nums">
            {current + 1} / {cards.length}
          </span>
          <Button variant="tertiary" className="min-h-11" onPress={() => go(1)} isDisabled={current === last}>
            Next
            <Icon icon="lucide:chevron-right" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </WrappedUsersContext.Provider>
  );
}
