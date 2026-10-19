import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Chip, Modal, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";

import { sendWrappedTest } from "@/api/seasonWrapped";
import { UserSelect } from "@/components/UserSelect";
import { percent, summarizeEngagement } from "@/components/admin-dashboard/season-wrapped/engagement";
import { reportWrappedError } from "@/components/admin-dashboard/season-wrapped/report-error";
import { WrappedMemberList } from "@/components/admin-dashboard/season-wrapped/wrapped-member-list";
import { WrappedSendPanel } from "@/components/admin-dashboard/season-wrapped/wrapped-send-panel";
import {
  useGenerateWrapped,
  usePublishWrapped,
  useWrappedAdminRows,
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

function generatedToast(year: number, result: GenerateSeasonWrappedResponse) {
  const skipped = result.skipped
    ? ` ${result.skipped} selected ${result.skipped === 1 ? "member isn't" : "members aren't"} eligible (no ${year} payment or event).`
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
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const seasonQuery = useWrappedSeason(year);
  const rowsQuery = useWrappedAdminRows(year);
  const { users } = useUsers();
  const generate = useGenerateWrapped(year);
  const publish = usePublishWrapped(year);

  const season = seasonQuery.data;
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const summary = useMemo(() => summarizeEngagement(rows), [rows]);
  const published = season?.status === SEASON_WRAPPED_STATUS.PUBLISHED;
  const activeUsers = useMemo(() => users.filter((u) => u.isMigrated !== true), [users]);

  const testMutation = useMutation({
    mutationFn: (uid: string) => sendWrappedTest({ year, uid }),
    onMutate: (uid) => setBusyUid(uid),
    onSuccess: (result) =>
      addToast({
        title: "Test sent",
        description: `Check ${result.email} and your notifications.`,
        color: "success",
      }),
    onError: (error) => reportWrappedError(error, "Couldn't send the test"),
    onSettled: () => setBusyUid(null),
  });

  const runGenerate = (uids?: string[], fromPicker = false) =>
    generate.mutate(uids, {
      onSuccess: (result) => {
        generatedToast(year, result);
        if (fromPicker) setSelected([]);
      },
      onError: (error) => reportWrappedError(error, "Couldn't generate Wrapped"),
      onSettled: () => setBusyUid(null),
    });

  const onConfirm = () => {
    if (confirm === "regenerate-all") runGenerate();
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
              onPress={() => setYear(y)}
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
              isPending={generate.isPending && !busyUid && selected.length === 0}
              isDisabled={generate.isPending}
              onPress={() => (season ? setConfirm("regenerate-all") : runGenerate())}
            >
              <Icon icon="lucide:refresh-cw" className="h-4 w-4" />
              {season ? "Regenerate everyone" : "Generate everyone"}
            </Button>
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
              isDisabled={selected.length === 0 || generate.isPending}
              isPending={generate.isPending && selected.length > 0}
              onPress={() => runGenerate(selected, true)}
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

          {rowsQuery.isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <WrappedMemberList
              rows={rows}
              busyUid={busyUid}
              onPreview={(uid) => navigate(wrappedPreviewLink(year, uid))}
              onSendTest={(uid) => testMutation.mutate(uid)}
              onRegenerate={(uid) => {
                setBusyUid(uid);
                runGenerate([uid]);
              }}
            />
          )}
        </>
      )}

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
