import { useState } from "react";
import { Button, Card, Chip, Skeleton, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { HomePopupEditor } from "@/components/admin-dashboard/home-popup/home-popup-editor";
import { HomePopupTemplatePicker } from "@/components/admin-dashboard/home-popup/home-popup-template-picker";
import { STATE_META, audienceLabel } from "@/components/admin-dashboard/home-popup/labels";
import type { HomePopupResponseCounts } from "@/api/homePopups";
import {
  useAllHomePopups,
  useHomePopupResponseCounts,
} from "@/hooks/useHomePopups";
import { useAuth } from "@/providers/AuthProvider";
import { HOME_POPUP_ACTION, type HomePopup } from "@/types/homePopup";
import { useAdminFlag } from "@/utils/admin";
import {
  formFromPopup,
  formFromTemplate,
  formatPopupDate,
  homePopupState,
  type HomePopupForm,
} from "@/utils/homePopup";

/** `session` remounts the editor for each popup opened, even the same one twice. */
type Editing = { session: number; id?: string; initialForm: HomePopupForm };

function dateRange(popup: HomePopup): string {
  const start = formatPopupDate(popup.startDate);
  return popup.endDate ? `${start} – ${formatPopupDate(popup.endDate)}` : `From ${start}`;
}

/** "12 clicked · 30 closed · 29%" for a popup's row; nothing until it has responses. */
function ResponseTotals({ counts }: { counts?: HomePopupResponseCounts }) {
  if (!counts) return null;
  const clicked = counts[HOME_POPUP_ACTION.CLICKED];
  const closed = counts[HOME_POPUP_ACTION.DISMISSED];
  const total = clicked + closed;
  if (!total) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted tabular-nums">
      <Icon icon="lucide:mouse-pointer-click" className="size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-foreground">{clicked}</span> clicked
        {" · "}
        {closed} closed · {Math.round((clicked / total) * 100)}%
      </span>
    </span>
  );
}

export function HomePopupTab() {
  const { user } = useAuth();
  const { isAdmin, loadingAdmin } = useAdminFlag(user);
  const popups = useAllHomePopups(isAdmin);
  // Only popups that have been live can have responses.
  const counts = useHomePopupResponseCounts(
    (popups.data ?? []).filter((p) => p.publishedAt).map((p) => p.id),
  );
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (loadingAdmin) return <Spinner className="mx-auto mt-8" />;

  const open = (initialForm: HomePopupForm, id?: string) =>
    setEditing((prev) => ({ session: (prev?.session ?? 0) + 1, id, initialForm }));

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <Icon
          icon="lucide:megaphone"
          width={22}
          height={22}
          className="mt-0.5 shrink-0 text-accent"
        />
        <div>
          <h2 className="text-xl font-semibold">Home popup</h2>
          <p className="text-sm text-muted">
            Shows on the home page. Each person sees it once, then it stays
            dismissed.
          </p>
        </div>
      </div>
      {!editing && (
        <Button className="min-h-11 sm:min-h-10" onPress={() => setPickerOpen(true)}>
          <Icon icon="lucide:plus" aria-hidden />
          New popup
        </Button>
      )}
    </div>
  );

  const editingPopup = editing?.id
    ? popups.data?.find((p) => p.id === editing.id)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-5xl pt-4">
      {header}

      {editing ? (
        <HomePopupEditor
          key={editing.session}
          popup={editingPopup}
          initialForm={editing.initialForm}
          onSaved={(id) => setEditing((prev) => (prev ? { ...prev, id } : prev))}
          onClose={() => setEditing(null)}
        />
      ) : (
        <div className="mt-4">
          {popups.isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl" />
          ) : popups.isError ? (
            <p className="text-sm text-danger">
              Couldn&apos;t load popups. Refresh to try again.
            </p>
          ) : !popups.data?.length ? (
            <Card className="border border-separator bg-surface">
              <Card.Content className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-sm text-muted">
                  No popups yet. Start from a template like &ldquo;Memberships
                  are open&rdquo;.
                </p>
                <Button onPress={() => setPickerOpen(true)}>New popup</Button>
              </Card.Content>
            </Card>
          ) : (
            <Card className="overflow-hidden border border-separator bg-surface p-0">
              <ul className="divide-y divide-separator">
                {popups.data.map((popup) => {
                  const meta = STATE_META[homePopupState(popup)];
                  return (
                    <li key={popup.id}>
                      <Button
                        variant="ghost"
                        fullWidth
                        className="h-auto min-h-14 justify-between rounded-none px-4 py-3 text-left"
                        onPress={() => open(formFromPopup(popup), popup.id)}
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate font-medium">
                            {popup.title || "Untitled popup"}
                          </span>
                          <span className="text-xs text-muted">
                            {dateRange(popup)}
                          </span>
                          <ResponseTotals counts={counts[popup.id]} />
                        </span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          <Chip size="sm" variant="soft" className="hidden sm:inline-flex">
                            {audienceLabel(popup.audience)}
                          </Chip>
                          <Chip size="sm" variant="soft" color={meta.color}>
                            {meta.label}
                          </Chip>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      <HomePopupTemplatePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(template) => {
          setPickerOpen(false);
          open(formFromTemplate(template));
        }}
      />
    </div>
  );
}
