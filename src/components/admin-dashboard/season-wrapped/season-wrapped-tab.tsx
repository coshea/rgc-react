import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Chip, Label, Modal, ProgressBar, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";

import { sendWrappedTest } from "@/api/seasonWrapped";
import { UserSelect } from "@/components/UserSelect";
import { percent, summarizeEngagement } from "@/components/admin-dashboard/season-wrapped/engagement";
import {
  GENERATION_ROW_STATE,
  generationProgress,
  generationRowStates,
  type GenerationRequests,
} from "@/components/admin-dashboard/season-wrapped/generation";
import { reportWrappedError } from "@/components/admin-dashboard/season-wrapped/report-error";
import { WrappedMemberList } from "@/components/admin-dashboard/season-wrapped/wrapped-member-list";
import { WrappedSendPanel } from "@/components/admin-dashboard/season-wrapped/wrapped-send-panel";
import {
  useGenerateWrapped,
  usePublishWrapped,
  useWrappedAdminRows,
  useWrappedGeneration,
  useWrappedSeason,
} from "@/hooks/useSeasonWrapped";
import { useUsers } from "@/hooks/useUsers";
import { addToast } from "@/providers/toast";
import { defaultWrappedYear, wrappedPreviewLink } from "@/utils/seasonWrapped";
import {
  SEASON_WRAPPED_STATUS,
  type GenerateSeasonWrappedResponse,
} from "@@/seasonWrapped/types";

type Confirm = "regenerate-all" | "publish" | "unpublish" | null;

/** How long skipped members stay in the list after a run, so the admin sees who they were. */
const SKIPPED_VISIBLE_MS = 8000;
/** Re-check for runs that died while pending (see STALE_PENDING_MS). */
const NOW_TICK_MS = 30 * 1000;

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function generatedToast(year: number, result: GenerateSeasonWrappedResponse, names: ReadonlyMap<string, string>) {
  const who = (result.skippedUids ?? []).map((uid) => names.get(uid) ?? "Unknown member").join(", ");
  const skipped = result.skipped
    ? ` Not eligible (no ${year} payment or event): ${who}.`
    : "";
  const images = result.shareImagesFailed
    ? ` ${result.shareImagesFailed} share images failed and will be made when first opened.`
    : "";
  addToast({
    title: `Generated ${result.generated} ${result.generated === 1 ? "story" : "stories"}`,
    description: `${skipped}${images}`.trim() || "Nothing was sent to members.",
    color: result.skipped || result.shareImagesFailed ? "warning" : "success",
  });
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-separator bg-surface p-3">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {detail && <span className="text-xs text-muted">{detail}</span>}
    </div>
  );
}

/**
 * Admin controls for Season Wrapped: generate (everyone or selected members),
 * preview any member's story, send yourself a test, publish, send
 * announcements, and see who opened it.
 */
export function SeasonWrappedTab() {
  const navigate = useNavigate();
  const thisSeason = defaultWrappedYear();
  const [year, setYear] = useState(thisSeason);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [testingUid, setTestingUid] = useState<string | null>(null);
  const [requests, setRequests] = useState<GenerationRequests>(new Map());
  const [fullRunning, setFullRunning] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const runRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const seasonQuery = useWrappedSeason(year);
  const { rows, isLoading: rowsLoading } = useWrappedAdminRows(year);
  const generation = useWrappedGeneration(year);
  const { users } = useUsers();
  const generate = useGenerateWrapped(year);
  const publish = usePublishWrapped(year);

  const season = seasonQuery.data;
  const summary = useMemo(() => summarizeEngagement(rows), [rows]);
  const published = season?.status === SEASON_WRAPPED_STATUS.PUBLISHED;
  const activeUsers = useMemo(() => users.filter((u) => u.isMigrated !== true), [users]);
  const names = useMemo(
    () => new Map(users.map((u) => [u.id, u.displayName || u.email || "Unknown member"])),
    [users],
  );
  const states = useMemo(() => generationRowStates(generation, requests, now), [generation, requests, now]);
  const progress = useMemo(() => generationProgress(states, requests, generation), [states, requests, generation]);
  const failedUids = useMemo(
    () => [...states].filter(([, state]) => state === GENERATION_ROW_STATE.FAILED).map(([uid]) => uid),
    [states],
  );

  useEffect(() => {
    if (!progress) return;
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(id);
  }, [progress]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const testMutation = useMutation({
    mutationFn: (uid: string) => sendWrappedTest({ year, uid }),
    onMutate: (uid) => setTestingUid(uid),
    onSuccess: (result) =>
      addToast({
        title: "Test sent",
        description: `Check ${result.email} and your notifications.`,
        color: "success",
      }),
    onError: (error) => reportWrappedError(error, "Couldn't send the test"),
    onSettled: () => setTestingUid(null),
  });

  /** Drops this run's requests, except `keep`. */
  const clearRun = (run: number, keep: readonly string[] = []) =>
    setRequests((prev) => {
      const next = new Map(prev);
      for (const [uid, request] of prev) {
        if (request.run === run && !keep.includes(uid)) next.delete(uid);
      }
      return next;
    });

  /**
   * Marks the members pending straight away (the server's own flags land once
   * it has loaded the season), then lets the live status docs take over.
   * `mutateAsync` because per-call `mutate` callbacks only fire for the latest
   * of overlapping runs.
   */
  const runGenerate = async (uids?: string[]) => {
    const run = ++runRef.current;
    const targets = uids ?? rows.map((r) => r.story.uid);
    setRequests((prev) => {
      const next = new Map(prev);
      for (const uid of targets) next.set(uid, { prev: generation.get(uid)?.updatedAt ?? null, run });
      return next;
    });
    if (!uids) setFullRunning(true);
    try {
      const result = await generate.mutateAsync(uids);
      generatedToast(year, result, names);
      // `?? []`: the site can deploy before the function that returns it.
      clearRun(run, result.skippedUids ?? []);
      timersRef.current.push(setTimeout(() => clearRun(run), SKIPPED_VISIBLE_MS));
    } catch (error) {
      reportWrappedError(error, "Couldn't generate Wrapped");
      clearRun(run);
    } finally {
      if (!uids) setFullRunning(false);
    }
  };

  const changeYear = (y: number) => {
    setYear(y);
    setRequests(new Map());
  };

  const onConfirm = () => {
    if (confirm === "regenerate-all") void runGenerate();
    if (confirm === "publish" || confirm === "unpublish") {
      publish.mutate(confirm === "publish", {
        onSuccess: (r) =>
          addToast({
            title: r.published ? "Wrapped published" : "Wrapped unpublished",
            description: r.published
              ? "Members can open their stories now. Nothing was sent yet."
              : "Members can no longer open their stories.",
            color: "success",
          }),
        onError: (error) => reportWrappedError(error, "Couldn't change publishing"),
      });
    }
    setConfirm(null);
  };

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Icon icon="lucide:gift" width={22} height={22} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <h2 className="text-xl font-semibold">Season Wrapped</h2>
            <p className="text-sm text-muted">
              Each member&apos;s year-end story. Generate and preview it here, then publish and send.
            </p>
          </div>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Season">
          {[thisSeason, thisSeason - 1].map((y) => (
            <Button
              key={y}
              size="sm"
              className="min-h-11 sm:min-h-9"
              variant={y === year ? "primary" : "tertiary"}
              aria-pressed={y === year}
              onPress={() => changeYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border border-separator">
        <Card.Content className="flex flex-col gap-4 p-4">
          {seasonQuery.isLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Chip color={published ? "success" : season ? "warning" : "default"} variant="soft">
                {published ? "Published" : season ? "Draft" : "Not generated"}
              </Chip>
              {season && (
                <span className="text-sm text-muted">
                  {season.memberCount} stories · generated {formatTimestamp(season.generatedAt)}
                  {published && ` · published ${formatTimestamp(season.publishedAt)}`}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-11"
              isPending={fullRunning}
              // A full run deletes stale stories, so it mustn't overlap anything else.
              isDisabled={progress !== null || generate.isPending}
              onPress={() => (season ? setConfirm("regenerate-all") : void runGenerate())}
            >
              <Icon icon="lucide:refresh-cw" className="h-4 w-4" />
              {season ? "Regenerate everyone" : "Generate everyone"}
            </Button>
            {failedUids.length > 0 && (
              <Button
                variant="danger-soft"
                className="min-h-11"
                isDisabled={fullRunning}
                onPress={() => void runGenerate(failedUids)}
              >
                <Icon icon="lucide:rotate-ccw" className="h-4 w-4" />
                Regenerate {failedUids.length} failed
              </Button>
            )}
            {season && (
              <Button
                variant={published ? "tertiary" : "secondary"}
                className="min-h-11"
                isPending={publish.isPending}
                onPress={() => setConfirm(published ? "unpublish" : "publish")}
              >
                <Icon icon={published ? "lucide:eye-off" : "lucide:eye"} className="h-4 w-4" />
                {published ? "Unpublish" : "Publish"}
              </Button>
            )}
          </div>

          {progress && (
            <ProgressBar value={progress.done} maxValue={progress.total} size="sm" className="gap-1">
              <div className="flex justify-between text-sm">
                <Label>
                  Generating {progress.done} of {progress.total}
                </Label>
                <ProgressBar.Output className="text-muted" />
              </div>
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          )}

          {/* Top-aligned: the selection summary under the input grows, so items-end would track it, not the input. */}
          <div className="flex flex-col gap-2 border-t border-separator pt-4 sm:flex-row sm:items-start">
            <UserSelect
              users={activeUsers}
              label="Generate for selected members"
              placeholder="Search members"
              value={selected}
              onChange={(v) => setSelected(Array.isArray(v) ? v : [v])}
              multiple
              className="min-w-0 flex-1"
            />
            <Button
              variant="tertiary"
              // Label (20px) + gap (4px), less half the 44px button / 40px input difference: centered on the input.
              className="min-h-11 sm:mt-5.5"
              isDisabled={selected.length === 0 || fullRunning}
              onPress={() => {
                // Cleared now: the members move from the picker into the list below.
                setSelected([]);
                void runGenerate(selected);
              }}
            >
              Generate {selected.length || ""} selected
            </Button>
          </div>
          <p className="text-xs text-muted">
            Generating never emails or notifies anyone. Stories are replaced in place, so links already sent show the new version.
          </p>
        </Card.Content>
      </Card>

      {season && (
        <>
          <section aria-label="Engagement" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Opened" value={percent(summary.opened, summary.members)} detail={`${summary.opened} of ${summary.members}`} />
            <Stat label="Finished" value={percent(summary.finished, summary.opened)} detail="of those who opened" />
            <Stat label="Shared" value={percent(summary.shared, summary.opened)} detail={`${summary.shared} members`} />
            <Stat
              label="Email clicks"
              value={percent(summary.emailClicked, summary.emailSent)}
              detail={`${summary.emailClicked} of ${summary.emailSent} emailed`}
            />
          </section>
          <p className="-mt-3 text-xs text-muted">
            Opens by source: email {summary.opensBySource.email}, push / bell {summary.opensBySource.push}, banner{" "}
            {summary.opensBySource.banner}, direct {summary.opensBySource.direct}. Admin previews aren&apos;t counted.
          </p>

          {/* Keyed by year so a preview never carries over to another season. */}
          <WrappedSendPanel key={year} year={year} published={published} />
        </>
      )}

      {/* Shown before the first story exists too, so members being generated have somewhere to appear. */}
      {(season || states.size > 0) &&
        (rowsLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <WrappedMemberList
            rows={rows}
            states={states}
            names={names}
            testingUid={testingUid}
            onPreview={(uid) => navigate(wrappedPreviewLink(year, uid))}
            onSendTest={(uid) => testMutation.mutate(uid)}
            onRegenerate={(uid) => void runGenerate([uid])}
          />
        ))}

      <Modal.Backdrop isOpen={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <h2 className="text-lg font-semibold">
                {confirm === "regenerate-all" && "Regenerate every story?"}
                {confirm === "publish" && `Publish ${year} Wrapped?`}
                {confirm === "unpublish" && `Unpublish ${year} Wrapped?`}
              </h2>
            </Modal.Header>
            <Modal.Body className="text-sm">
              {confirm === "regenerate-all" &&
                (published
                  ? "Wrapped is live. Members who come back will see the new numbers, and their share images will change. Nothing is sent."
                  : "Every member's story and share image is rebuilt from current data. Nothing is sent.")}
              {confirm === "publish" &&
                "Members can open their stories from the site and the home page banner appears. No email or notification is sent until you use Send announcements."}
              {confirm === "unpublish" &&
                "Members will no longer be able to open their stories, including from links already sent."}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button variant={confirm === "unpublish" ? "danger" : "primary"} onPress={onConfirm}>
                {confirm === "regenerate-all" && "Regenerate"}
                {confirm === "publish" && "Publish"}
                {confirm === "unpublish" && "Unpublish"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
