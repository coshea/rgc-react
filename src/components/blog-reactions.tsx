import React from "react";
import { Button, Popover, ToggleButton, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";

import { computeDisplayName } from "@/api/users";
import {
  useBlogReactions,
  useToggleBlogReaction,
} from "@/hooks/useBlogReactions";
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import {
  BLOG_REACTIONS,
  type BlogReactionDef,
  type ReactionKey,
} from "@/types/blog";

interface BlogReactionsProps {
  postId: string | undefined;
  /** Home page cards: smaller chips, top 3 emojis, the rest behind "+N more". */
  compact?: boolean;
  className?: string;
}

const COMPACT_LIMIT = 3;
const MAX_TOOLTIP_NAMES = 8;

// Outlined and transparent by default; HeroUI's selected state supplies the
// soft accent tint, so only the member's own reactions carry colour.
const CHIP_BASE =
  "rounded-full border border-border tabular-nums [--toggle-button-bg:transparent] data-[selected=true]:border-accent/40";
// Compact chips look 28px tall; the ::before extends the tap target to 44px.
const CHIP_COMPACT =
  "h-7 min-h-0 gap-1 px-2 text-xs md:h-7 before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']";
const CHIP_FULL = "min-h-11 gap-1 px-3 text-sm sm:min-h-9";

function reactionLabel(def: BlogReactionDef, count: number) {
  return `${def.label}, ${count} ${count === 1 ? "reaction" : "reactions"}`;
}

type NameLookup = (uid: string) => string;

function useReactorName(): NameLookup {
  const { user } = useAuth();
  const { usersMap } = useUsersMap();
  const nameOf = React.useCallback<NameLookup>(
    (uid) => {
      if (uid === user?.uid) return "You";
      const member = usersMap.get(uid);
      return (member && computeDisplayName(member)) || "Member";
    },
    [user?.uid, usersMap],
  );
  return nameOf;
}

/** Puts "You" first, keeping the rest in the order they were read. */
function namesFor(uids: readonly string[], nameOf: NameLookup): string[] {
  const names = uids.map(nameOf);
  const youIndex = names.indexOf("You");
  if (youIndex > 0) {
    names.splice(youIndex, 1);
    names.unshift("You");
  }
  return names;
}

function NamesList({ names }: { names: string[] }) {
  const extra = names.length - MAX_TOOLTIP_NAMES;
  return (
    <ul className="text-xs leading-5">
      {names.slice(0, MAX_TOOLTIP_NAMES).map((name, i) => (
        <li key={`${name}-${i}`}>{name}</li>
      ))}
      {extra > 0 && <li className="text-muted">and {extra} more</li>}
    </ul>
  );
}

/**
 * Emoji reactions on a blog post. Members only: renders nothing while auth is
 * loading or the visitor is logged out.
 */
export function BlogReactions({ postId, ...rest }: BlogReactionsProps) {
  const { loading, userLoggedIn } = useAuth();
  if (loading || !userLoggedIn || !postId) return null;
  return <BlogReactionsBar postId={postId} {...rest} />;
}

function BlogReactionsBar({
  postId,
  compact = false,
  className = "",
}: BlogReactionsProps & { postId: string }) {
  const { counts, reactors, mine, total } = useBlogReactions(postId);
  const { toggle } = useToggleBlogReaction(postId);
  const nameOf = useReactorName();

  const used = BLOG_REACTIONS.filter((r) => counts[r.key] > 0);
  // Array.sort is stable, so ties keep BLOG_REACTIONS order.
  const shown = compact
    ? [...used]
        .sort((a, b) => counts[b.key] - counts[a.key])
        .slice(0, COMPACT_LIMIT)
    : used;
  const hidden = used.filter((def) => !shown.includes(def));

  const chip = (def: BlogReactionDef, longPress = true) => (
    <ReactionChip
      longPress={longPress}
      key={def.key}
      def={def}
      count={counts[def.key]}
      isMine={mine.includes(def.key)}
      names={namesFor(reactors[def.key], nameOf)}
      compact={compact}
      onToggle={toggle}
    />
  );

  return (
    <div
      role="group"
      aria-label="Reactions"
      className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"} ${className}`}
    >
      {shown.map((def) => chip(def))}

      {hidden.length > 0 && (
        <MoreReactions hidden={hidden} compact={compact}>
          {hidden.map((def) => (
            <li key={def.key} className="flex items-start gap-2">
              {chip(def, false)}
              <span className="pt-1 text-xs text-muted">
                {namesFor(reactors[def.key], nameOf).join(", ")}
              </span>
            </li>
          ))}
        </MoreReactions>
      )}

      <ReactionPicker mine={mine} onToggle={toggle} compact={compact} />

      {!compact && total === 0 && (
        <span className="text-sm text-muted">Be the first to react</span>
      )}
    </div>
  );
}

const LONG_PRESS_MS = 500;
// A finger that drifts further than this is scrolling, not holding.
const LONG_PRESS_MOVE_TOLERANCE = 10;

/**
 * Touch press-and-hold. Phones can't hover, so holding a chip is how they see
 * who reacted. Returns handlers for a native wrapper element, and `consume()`,
 * which reports (once) whether the press that just ended was a long press, so
 * the release doesn't also toggle the reaction.
 */
function useLongPress(onLongPress: () => void) {
  const timer = React.useRef<number | undefined>(undefined);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const fired = React.useRef(false);

  const cancel = React.useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    start.current = null;
  }, []);

  React.useEffect(() => cancel, [cancel]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      if (e.pointerType !== "touch") return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = undefined;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // Android raises a context menu on long press; we've used the gesture.
    onContextMenu: (e: React.MouseEvent) => {
      if (fired.current) e.preventDefault();
    },
  };

  const consume = () => {
    const wasLongPress = fired.current;
    fired.current = false;
    return wasLongPress;
  };

  return { handlers, consume };
}

/**
 * A toggleable emoji count. Hovering or keyboard focus lists who reacted in a
 * tooltip; on touch screens, press and hold opens the same list.
 */
function ReactionChip({
  def,
  count,
  isMine,
  names,
  compact,
  onToggle,
  longPress = true,
}: {
  def: BlogReactionDef;
  count: number;
  isMine: boolean;
  names: string[];
  compact: boolean;
  onToggle: (key: ReactionKey) => void;
  /** Off where the names are already on screen (the "+N more" popover). */
  longPress?: boolean;
}) {
  const chipRef = React.useRef<HTMLButtonElement>(null);
  const namesId = React.useId();
  const [namesOpen, setNamesOpen] = React.useState(false);
  const hold = useLongPress(() => setNamesOpen(true));

  const heading = (
    <p className="mb-0.5 text-xs font-semibold">
      {def.emoji} {def.label}
    </p>
  );

  return (
    // Native wrapper for the hold gesture: pointer events bubble up from the
    // chip, which keeps its own press handling for the toggle.
    <span
      className="inline-flex select-none [-webkit-touch-callout:none]"
      {...(longPress ? hold.handlers : {})}
    >
      <Tooltip delay={300} closeDelay={0}>
        <ToggleButton
          ref={chipRef}
          size="sm"
          isSelected={isMine}
          onChange={() => {
            if (!hold.consume()) onToggle(def.key);
          }}
          aria-label={reactionLabel(def, count)}
          aria-describedby={namesId}
          className={`${CHIP_BASE} ${compact ? CHIP_COMPACT : CHIP_FULL}`}
        >
          <span aria-hidden="true">{def.emoji}</span>
          <span aria-hidden="true">{count}</span>
        </ToggleButton>
        <Tooltip.Content placement="top" offset={6} className="max-w-56">
          {heading}
          <NamesList names={names} />
        </Tooltip.Content>
      </Tooltip>
      {/* Screen readers get the names without hovering or holding. */}
      <span id={namesId} className="sr-only">
        {names.join(", ")}
      </span>
      {longPress && (
        <Popover.Content
          triggerRef={chipRef}
          isOpen={namesOpen}
          onOpenChange={setNamesOpen}
          placement="top"
          className="max-w-[calc(100vw-2rem)]"
        >
          <Popover.Dialog aria-label={`${def.label} reactions`}>
            {heading}
            <NamesList names={names} />
          </Popover.Dialog>
        </Popover.Content>
      )}
    </span>
  );
}

/**
 * "+N more" for compact rows. Hovering lists the hidden emojis; pressing opens
 * a popover with who reacted, where members can toggle them too. The popover
 * is what phones get, since they can't hover.
 */
function MoreReactions({
  hidden,
  compact,
  children,
}: {
  hidden: BlogReactionDef[];
  compact: boolean;
  children: React.ReactNode;
}) {
  const label = `${hidden.length} more ${hidden.length === 1 ? "reaction" : "reactions"}`;
  return (
    <Popover>
      <Tooltip delay={300} closeDelay={0}>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Show ${label}`}
          className={`relative ${CHIP_BASE} ${compact ? CHIP_COMPACT : CHIP_FULL} text-muted`}
        >
          +{hidden.length} more
        </Button>
        <Tooltip.Content placement="top" offset={6}>
          <span className="text-base" aria-hidden="true">
            {hidden.map((def) => def.emoji).join(" ")}
          </span>
          <span className="sr-only">
            {hidden.map((def) => def.label).join(", ")}
          </span>
        </Tooltip.Content>
      </Tooltip>
      <Popover.Content placement="top" className="max-w-[calc(100vw-2rem)]">
        <Popover.Dialog aria-label={label}>
          <ul className="max-w-72 space-y-3 py-1">{children}</ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function ReactionPicker({
  mine,
  onToggle,
  compact,
}: {
  mine: readonly ReactionKey[];
  onToggle: (key: ReactionKey) => void;
  compact: boolean;
}) {
  return (
    <Popover>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label="Add reaction"
        className={
          compact
            ? `relative ${CHIP_BASE} ${CHIP_COMPACT} w-9 min-w-0 text-muted`
            : "min-h-11 min-w-11 rounded-full sm:min-h-9 sm:min-w-9"
        }
      >
        <Icon
          icon="lucide:smile-plus"
          className={compact ? "h-4 w-4" : "h-5 w-5"}
        />
      </Button>
      <Popover.Content placement="top" className="max-w-[calc(100vw-2rem)]">
        <Popover.Dialog aria-label="Choose reactions">
          <div className="grid grid-cols-5 gap-1">
            {BLOG_REACTIONS.map((def) => (
              <ToggleButton
                key={def.key}
                variant="ghost"
                isIconOnly
                isSelected={mine.includes(def.key)}
                onChange={() => onToggle(def.key)}
                aria-label={def.label}
                className="h-11 w-11 text-2xl"
              >
                <span aria-hidden="true">{def.emoji}</span>
              </ToggleButton>
            ))}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
