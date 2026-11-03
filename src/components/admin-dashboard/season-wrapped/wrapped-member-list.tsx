import { useMemo, useState } from "react";
import { Button, Chip, Dropdown, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import type { WrappedAdminRow } from "@/api/seasonWrapped";
import { UserAvatar } from "@/components/avatar";
import { SearchInput } from "@/components/search-input";
import {
  ENGAGEMENT_FILTER,
  matchesFilter,
  type EngagementFilter,
} from "@/components/admin-dashboard/season-wrapped/engagement";
import {
  GENERATION_ROW_STATE,
  type GenerationRowState,
} from "@/components/admin-dashboard/season-wrapped/generation";

const FILTERS: { id: EngagementFilter; label: string }[] = [
  { id: ENGAGEMENT_FILTER.ALL, label: "All" },
  { id: ENGAGEMENT_FILTER.NOT_OPENED, label: "Not opened" },
  { id: ENGAGEMENT_FILTER.OPENED, label: "Opened" },
  { id: ENGAGEMENT_FILTER.FINISHED, label: "Finished" },
  { id: ENGAGEMENT_FILTER.SHARED, label: "Shared" },
  { id: ENGAGEMENT_FILTER.NOT_SENT, label: "Not sent" },
];

const SOURCE_LABEL: Record<string, string> = {
  email: "Email",
  push: "Push / bell",
  banner: "Banner",
  direct: "Direct",
};

function formatWhen(value: unknown): string | null {
  let date: Date | null = null;
  if (typeof value === "string") date = new Date(value);
  else if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const d: unknown = value.toDate();
    date = d instanceof Date ? d : null;
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface WrappedMemberListProps {
  rows: WrappedAdminRow[];
  /** Generate state per member; members with none are idle. */
  states: ReadonlyMap<string, GenerationRowState>;
  /** Names for members being generated who don't have a story yet. */
  names: ReadonlyMap<string, string>;
  testingUid: string | null;
  onPreview: (uid: string) => void;
  onSendTest: (uid: string) => void;
  onRegenerate: (uid: string) => void;
}

/** Pending and skipped members sit at the top, whatever the filter, until their run finishes. */
function isPinned(state: GenerationRowState | undefined): state is GenerationRowState {
  return state === GENERATION_ROW_STATE.PENDING || state === GENERATION_ROW_STATE.SKIPPED;
}

function GeneratingNote({ state, hasStory }: { state: GenerationRowState; hasStory: boolean }) {
  if (state === GENERATION_ROW_STATE.SKIPPED) {
    return <p className="text-xs text-warning">Not eligible: no payment or event this season</p>;
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted">
      <Spinner size="sm" className="size-3" />
      {hasStory ? "Regenerating…" : "Generating…"}
    </p>
  );
}

export function WrappedMemberList({
  rows,
  states,
  names,
  testingUid,
  onPreview,
  onSendTest,
  onRegenerate,
}: WrappedMemberListProps) {
  const [filter, setFilter] = useState<EngagementFilter>(ENGAGEMENT_FILTER.ALL);
  const [search, setSearch] = useState("");

  const { pinned, placeholders, visible } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byName = (a: WrappedAdminRow, b: WrappedAdminRow) => a.story.displayName.localeCompare(b.story.displayName);
    const withStory = new Set(rows.map((r) => r.story.uid));
    return {
      pinned: rows.filter((r) => isPinned(states.get(r.story.uid))).sort(byName),
      placeholders: [...states]
        .filter(([uid, state]) => isPinned(state) && !withStory.has(uid))
        .map(([uid, state]) => ({ uid, state, name: names.get(uid) ?? "Unknown member" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      visible: rows
        .filter((r) => !isPinned(states.get(r.story.uid)))
        .filter((r) => matchesFilter(r, filter))
        .filter((r) => !q || r.story.displayName.toLowerCase().includes(q))
        .sort(byName),
    };
  }, [rows, states, names, filter, search]);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="wrapped-members-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="wrapped-members-heading" className="text-lg font-semibold">
          Members{" "}
          <span className="text-sm font-normal text-muted">
            ({pinned.length + visible.length} of {rows.length})
          </span>
        </h3>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Find a member"
          ariaLabel="Find a member"
          className="w-full sm:w-64"
        />
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide" role="group" aria-label="Filter members">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "primary" : "tertiary"}
            className="min-h-11 shrink-0 sm:min-h-9"
            onPress={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-separator rounded-xl border border-separator bg-surface">
        {placeholders.map(({ uid, state, name }) => (
          <li key={uid} className="flex items-center gap-3 p-3" aria-busy={state === GENERATION_ROW_STATE.PENDING}>
            <UserAvatar name={name} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium">{name}</p>
              <GeneratingNote state={state} hasStory={false} />
            </div>
          </li>
        ))}
        {pinned.length + visible.length + placeholders.length === 0 && (
          <li className="p-4 text-sm text-muted">No members match.</li>
        )}
        {[...pinned, ...visible].map(({ story, delivery, view }) => {
          const opened = formatWhen(view?.firstOpenedAt);
          const state = states.get(story.uid);
          const generated = formatWhen(story.generatedAt);
          return (
            <li
              key={story.uid}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
              aria-busy={state === GENERATION_ROW_STATE.PENDING}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <UserAvatar name={story.displayName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{story.displayName}</p>
                  {isPinned(state) ? (
                    <GeneratingNote state={state} hasStory />
                  ) : (
                    <p className="text-xs text-muted">
                      {story.played ? `${story.events?.played ?? 0} events` : "Didn't play"} · v{story.version}
                      {generated && ` · ${generated}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {state === GENERATION_ROW_STATE.FAILED && (
                  <Chip size="sm" variant="soft" color="danger">
                    Last generate failed
                  </Chip>
                )}
                <Chip size="sm" variant="soft" color={delivery?.emailSentAt ? "success" : "default"}>
                  Email {delivery?.emailSentAt ? "sent" : "not sent"}
                </Chip>
                <Chip size="sm" variant="soft" color={delivery?.appSentAt ? "success" : "default"}>
                  App {delivery?.appSentAt ? "sent" : "not sent"}
                </Chip>
                {(delivery?.emailClicks ?? 0) > 0 && (
                  <Chip size="sm" variant="soft" color="accent">
                    {delivery!.emailClicks} email {delivery!.emailClicks === 1 ? "click" : "clicks"}
                  </Chip>
                )}
                {opened ? (
                  <Chip size="sm" variant="soft" color="accent">
                    Opened {opened} · {SOURCE_LABEL[view!.firstSource] ?? view!.firstSource}
                    {view!.openCount > 1 ? ` · ${view!.openCount}×` : ""}
                  </Chip>
                ) : (
                  <Chip size="sm" variant="soft">Not opened</Chip>
                )}
                {view && (
                  <Chip size="sm" variant="soft" color={view.completed ? "success" : "default"}>
                    {view.completed ? "Finished" : `Card ${view.furthestCard}/${view.cardCount}`}
                  </Chip>
                )}
                {view?.shared && (
                  <Chip size="sm" variant="soft" color="success">
                    Shared
                  </Chip>
                )}
              </div>

              <Dropdown>
                <Button
                  variant="tertiary"
                  size="sm"
                  className="min-h-11 self-end sm:min-h-9 sm:self-auto"
                  isPending={testingUid === story.uid || state === GENERATION_ROW_STATE.PENDING}
                  aria-label={`Actions for ${story.displayName}`}
                >
                  <Icon icon="lucide:ellipsis" className="h-4 w-4" />
                </Button>
                <Dropdown.Popover>
                  <Dropdown.Menu aria-label={`Actions for ${story.displayName}`}>
                    <Dropdown.Item id="preview" textValue="View story" onPress={() => onPreview(story.uid)}>
                      <span className="flex items-center gap-2">
                        <Icon icon="lucide:eye" className="text-base text-muted" />
                        View story
                      </span>
                    </Dropdown.Item>
                    <Dropdown.Item id="test" textValue="Send test to me" onPress={() => onSendTest(story.uid)}>
                      <span className="flex items-center gap-2">
                        <Icon icon="lucide:send" className="text-base text-muted" />
                        Send test to me
                      </span>
                    </Dropdown.Item>
                    <Dropdown.Item id="regenerate" textValue="Regenerate" onPress={() => onRegenerate(story.uid)}>
                      <span className="flex items-center gap-2">
                        <Icon icon="lucide:refresh-cw" className="text-base text-muted" />
                        Regenerate
                      </span>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
