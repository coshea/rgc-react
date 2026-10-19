import { useState } from "react";
import { Button, Card, Checkbox, Label, Modal } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sendWrappedAnnouncements } from "@/api/seasonWrapped";
import { wrappedKeys } from "@/hooks/useSeasonWrapped";
import { addToast } from "@/providers/toast";
import { reportWrappedError } from "@/components/admin-dashboard/season-wrapped/report-error";
import {
  SEASON_WRAPPED_CHANNEL,
  type ChannelSendCounts,
  type SeasonWrappedChannel,
  type SendSeasonWrappedResponse,
} from "@@/seasonWrapped/types";

const CHANNEL_LABEL: Record<SeasonWrappedChannel, string> = {
  [SEASON_WRAPPED_CHANNEL.EMAIL]: "Email",
  [SEASON_WRAPPED_CHANNEL.APP]: "App (bell + push)",
};

function CountsTable({ counts }: { counts: SendSeasonWrappedResponse["counts"] }) {
  const entries = Object.entries(counts) as [SeasonWrappedChannel, ChannelSendCounts][];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-1.5 pr-3 font-medium">Channel</th>
            <th className="py-1.5 pr-3 font-medium">Will send</th>
            <th className="py-1.5 pr-3 font-medium">Already sent</th>
            <th className="py-1.5 pr-3 font-medium">Opted out</th>
            <th className="py-1.5 font-medium">Can&apos;t deliver</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([channel, c]) => (
            <tr key={channel} className="border-t border-separator">
              <td className="py-1.5 pr-3">{CHANNEL_LABEL[channel]}</td>
              <td className="py-1.5 pr-3 font-semibold">{c.blocked ? 0 : c.toSend}</td>
              <td className="py-1.5 pr-3">{c.alreadySent}</td>
              <td className="py-1.5 pr-3">{c.optedOut}</td>
              <td className="py-1.5">{channel === SEASON_WRAPPED_CHANNEL.EMAIL ? c.undeliverable : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries
        .filter(([, c]) => c.blocked)
        .map(([channel, c]) => (
          <p key={channel} className="mt-2 text-sm text-danger">
            {CHANNEL_LABEL[channel]} won&apos;t send: {c.blocked}
          </p>
        ))}
    </div>
  );
}

interface WrappedSendPanelProps {
  year: number;
  published: boolean;
}

/**
 * Sends the announcement on the chosen channels to members who haven't had
 * that channel yet. Always previews the counts before the real send.
 */
export function WrappedSendPanel({ year, published }: WrappedSendPanelProps) {
  const queryClient = useQueryClient();
  const [channels, setChannels] = useState<Set<SeasonWrappedChannel>>(
    () => new Set([SEASON_WRAPPED_CHANNEL.EMAIL, SEASON_WRAPPED_CHANNEL.APP]),
  );
  const [preview, setPreview] = useState<SendSeasonWrappedResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = (channel: SeasonWrappedChannel, on: boolean) => {
    setPreview(null);
    setChannels((prev) => {
      const next = new Set(prev);
      if (on) next.add(channel);
      else next.delete(channel);
      return next;
    });
  };

  const previewMutation = useMutation({
    mutationFn: () => sendWrappedAnnouncements({ year, channels: [...channels], dryRun: true }),
    onSuccess: setPreview,
    onError: (error) => reportWrappedError(error, "Couldn't preview the send"),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendWrappedAnnouncements({ year, channels: [...channels], dryRun: false }),
    onSuccess: (result) => {
      setConfirmOpen(false);
      setPreview(null);
      const email = result.counts.email;
      const app = result.counts.app;
      const parts = [
        email && `${email.sent} emails`,
        app && `${app.sent} app notifications`,
      ].filter(Boolean);
      addToast({
        title: "Announcements sent",
        description: `Sent ${parts.join(" and ")}.${email?.failed ? ` ${email.failed} emails failed; send again to retry them.` : ""}`,
        color: email?.failed ? "warning" : "success",
      });
    },
    onError: (error) => reportWrappedError(error, "Couldn't send announcements"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: wrappedKeys.admin(year) });
      void queryClient.invalidateQueries({ queryKey: wrappedKeys.season(year) });
    },
  });

  const toSend = preview
    ? Object.values(preview.counts).reduce((sum, c) => sum + (c && !c.blocked ? c.toSend : 0), 0)
    : 0;

  return (
    <Card className="border border-separator">
      <Card.Content className="flex flex-col gap-4 p-4">
        <div>
          <h3 className="text-lg font-semibold">Send announcements</h3>
          <p className="text-sm text-muted">
            Goes only to members who haven&apos;t had that channel yet. Regenerating never sends anything.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          {Object.values(SEASON_WRAPPED_CHANNEL).map((channel) => (
            <Checkbox
              key={channel}
              id={`wrapped-channel-${channel}`}
              isSelected={channels.has(channel)}
              onChange={(on) => toggle(channel, on)}
            >
              <Checkbox.Content className="min-h-11">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label htmlFor={`wrapped-channel-${channel}`} className="cursor-pointer">
                  {CHANNEL_LABEL[channel]}
                </Label>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>

        {!published && (
          <p className="text-sm text-warning">Publish Wrapped before sending. You can still preview the counts.</p>
        )}

        {preview && <CountsTable counts={preview.counts} />}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="tertiary"
            className="min-h-11"
            isDisabled={channels.size === 0}
            isPending={previewMutation.isPending}
            onPress={() => previewMutation.mutate()}
          >
            Preview counts
          </Button>
          <Button
            className="min-h-11"
            isDisabled={!published || !preview || toSend === 0}
            onPress={() => setConfirmOpen(true)}
          >
            Send to {toSend} {toSend === 1 ? "recipient" : "recipients"}
          </Button>
        </div>
      </Card.Content>

      <Modal.Backdrop isOpen={confirmOpen} onOpenChange={setConfirmOpen}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <h2 className="text-lg font-semibold">Send {year} Wrapped?</h2>
            </Modal.Header>
            <Modal.Body>
              {preview && <CountsTable counts={preview.counts} />}
              <p className="mt-3 text-sm text-muted">Members who already got a channel won&apos;t get it again.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button isPending={sendMutation.isPending} onPress={() => sendMutation.mutate()}>
                Send now
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Card>
  );
}
