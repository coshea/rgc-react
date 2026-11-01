import { useState } from "react";
import { Card, Skeleton } from "@heroui/react";
import { Segment } from "@heroui-pro/react/segment";

import { UserAvatar } from "@/components/avatar";
import { useHomePopupResponses } from "@/hooks/useHomePopups";
import { useUsersMap } from "@/hooks/useUsers";
import {
  HOME_POPUP_ACTION,
  type HomePopup,
  type HomePopupAction,
} from "@/types/homePopup";

function isAction(key: unknown): key is HomePopupAction {
  return Object.values(HOME_POPUP_ACTION).includes(key as HomePopupAction);
}

function formatWhen(date: Date | undefined): string {
  if (!date) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-separator bg-surface p-3">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

/** Who among signed-in members clicked the popup's button or closed it. */
export function HomePopupResponses({ popup }: { popup: HomePopup }) {
  const responses = useHomePopupResponses(popup.id);
  const { usersMap } = useUsersMap();
  const [show, setShow] = useState<HomePopupAction>(HOME_POPUP_ACTION.CLICKED);

  const all = responses.data ?? [];
  const clicked = all.filter((r) => r.action === HOME_POPUP_ACTION.CLICKED);
  const closed = all.filter((r) => r.action === HOME_POPUP_ACTION.DISMISSED);
  const rate = all.length ? `${Math.round((clicked.length / all.length) * 100)}%` : "–";
  const rows = show === HOME_POPUP_ACTION.CLICKED ? clicked : closed;

  return (
    <Card className="border border-separator bg-surface">
      <Card.Content className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <h3 className="text-base font-semibold">Responses</h3>
          <p className="text-sm text-muted">
            Signed-in members only. Visitors are counted in Google Analytics
            (home_popup_click).
          </p>
        </div>

        {responses.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : responses.isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t load responses. Refresh to try again.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Clicked" value={String(clicked.length)} />
              <Stat label="Closed" value={String(closed.length)} />
              <Stat label="Click rate" value={rate} />
            </div>

            <Segment
              aria-label="Show members who"
              size="lg"
              selectedKey={show}
              onSelectionChange={(key) => {
                if (isAction(key)) setShow(key);
              }}
              className="w-full sm:w-auto"
            >
              <Segment.Item id={HOME_POPUP_ACTION.CLICKED} className="h-11 flex-1 lg:h-10">
                Clicked
              </Segment.Item>
              <Segment.Item id={HOME_POPUP_ACTION.DISMISSED} className="h-11 flex-1 lg:h-10">
                Closed
              </Segment.Item>
            </Segment>

            {rows.length === 0 ? (
              <p className="text-sm text-muted">
                {show === HOME_POPUP_ACTION.CLICKED
                  ? "No members have clicked yet."
                  : "No members have closed it yet."}
              </p>
            ) : (
              <ul className="flex max-h-96 flex-col divide-y divide-separator overflow-y-auto">
                {rows.map((r) => {
                  const user = usersMap.get(r.uid);
                  const name = user?.displayName || user?.email || "Unknown member";
                  return (
                    <li key={r.uid} className="flex min-h-14 items-center gap-3 py-2">
                      <UserAvatar user={user} name={user ? undefined : name} size="sm" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">{name}</span>
                        <span className="truncate text-xs text-muted">
                          {formatWhen(r.at)}
                          {r.link && show === HOME_POPUP_ACTION.CLICKED && ` · ${r.link}`}
                          {r.version < popup.version && " · earlier version"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
}
