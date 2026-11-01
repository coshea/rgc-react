import { useState } from "react";
import {
  Button,
  Calendar,
  Card,
  Checkbox,
  Chip,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { Segment } from "@heroui-pro/react/segment";
import { Icon } from "@iconify/react";
import { parseDate, type DateValue } from "@internationalized/date";

import { HomePopupPreviewCard } from "@/components/admin-dashboard/home-popup/home-popup-preview-card";
import { HomePopupResponses } from "@/components/admin-dashboard/home-popup/home-popup-responses";
import { HomePopupTemplatePicker } from "@/components/admin-dashboard/home-popup/home-popup-template-picker";
import {
  AUDIENCE_HELP,
  STATE_META,
  audienceLabel,
} from "@/components/admin-dashboard/home-popup/labels";
import { HomePopupDialog } from "@/components/home-popup/home-popup-dialog";
import { MarkdownEditor } from "@/components/markdown-editor";
import { useDeleteHomePopup, useSaveHomePopup } from "@/hooks/useHomePopups";
import { addToast } from "@/providers/toast";
import {
  HOME_POPUP_AUDIENCE,
  HOME_POPUP_STATUS,
  type HomePopup,
  type HomePopupAudience,
  type HomePopupStatus,
} from "@/types/homePopup";
import { extractFirebaseAuthError } from "@/utils/firebaseErrors";
import {
  HOME_POPUP_DEFAULT_DAYS,
  HOME_POPUP_TITLE_MAX,
  defaultEndYmd,
  findHomePopupTemplate,
  formFromTemplate,
  formToInput,
  homePopupState,
  validateHomePopupForm,
  type HomePopupForm,
  type HomePopupFormErrors,
} from "@/utils/homePopup";

function isAudience(key: unknown): key is HomePopupAudience {
  return Object.values(HOME_POPUP_AUDIENCE).includes(key as HomePopupAudience);
}

function toastSaveError(error: unknown) {
  addToast(
    extractFirebaseAuthError(error)?.code === "permission-denied"
      ? {
          title: "Access Denied",
          description: "You do not have permission to perform this action.",
          color: "danger",
        }
      : {
          title: "Couldn't save the popup",
          description: "Check your connection and try again.",
          color: "danger",
        },
  );
}

function DateOnlyPicker({
  label,
  value,
  onChange,
  error,
  isRequired,
}: {
  label: string;
  value: string;
  onChange: (ymd: string) => void;
  error?: string;
  isRequired?: boolean;
}) {
  return (
    <DatePicker
      value={value ? parseDate(value) : null}
      onChange={(v: DateValue | null) => onChange(v ? v.toString() : "")}
      isRequired={isRequired}
      isInvalid={!!error}
      className="w-full"
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {error && <FieldError>{error}</FieldError>}
      <DatePicker.Popover>
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" aria-label="Previous month" />
            <Calendar.NavButton slot="next" aria-label="Next month" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(d) => <Calendar.Cell date={d} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

interface HomePopupEditorProps {
  /** The saved popup, or undefined for a new one. */
  popup?: HomePopup;
  initialForm: HomePopupForm;
  /** Called with the id after every save, so a new popup becomes an edit. */
  onSaved: (id: string) => void;
  onClose: () => void;
}

export function HomePopupEditor({
  popup,
  initialForm,
  onSaved,
  onClose,
}: HomePopupEditorProps) {
  const [form, setForm] = useState<HomePopupForm>(initialForm);
  const [errors, setErrors] = useState<HomePopupFormErrors>({});
  const [showAgain, setShowAgain] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useSaveHomePopup();
  const remove = useDeleteHomePopup();

  const isPublished = popup?.status === HOME_POPUP_STATUS.PUBLISHED;
  const state = popup ? homePopupState(popup) : null;
  const template = findHomePopupTemplate(form.templateId);

  const update = <K extends keyof HomePopupForm>(
    key: K,
    value: HomePopupForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const persist = async (status: HomePopupStatus): Promise<string | null> => {
    const nextErrors = validateHomePopupForm(form, {
      publishing: status === HOME_POPUP_STATUS.PUBLISHED,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return null;
    try {
      const id = await save.mutateAsync({
        input: formToInput(form, status),
        options: { previous: popup, showAgain: showAgain && isPublished },
      });
      setShowAgain(false);
      setLastSaved(new Date());
      onSaved(id);
      return id;
    } catch (error) {
      toastSaveError(error);
      return null;
    }
  };

  const handleSaveDraft = async () => {
    if (await persist(HOME_POPUP_STATUS.DRAFT)) {
      addToast({
        title: isPublished ? "Unpublished" : "Draft saved",
        description: isPublished
          ? "Nobody sees it until you publish it again."
          : "Only admins can see it.",
        color: "success",
      });
    }
  };

  const handlePublish = async () => {
    if (await persist(HOME_POPUP_STATUS.PUBLISHED)) {
      addToast({
        title: isPublished ? "Changes saved" : "Published",
        description: `Shows on the home page for ${audienceLabel(form.audience).toLowerCase()}.`,
        color: "success",
      });
      onClose();
    }
  };

  // Drafts are saved first, so the admin can't lose work from the preview.
  // A live popup isn't saved, or unreviewed edits would go out to members.
  const handlePreview = async () => {
    if (!isPublished) {
      if (!(await persist(HOME_POPUP_STATUS.DRAFT))) return;
      addToast({
        title: "Draft saved",
        description: "Saved before the preview opened.",
        color: "success",
      });
    }
    setPreviewOpen(true);
  };

  const handleDelete = async () => {
    if (!popup) return;
    try {
      await remove.mutateAsync(popup.id);
      addToast({ title: "Popup deleted", color: "success" });
      onClose();
    } catch (error) {
      toastSaveError(error);
    } finally {
      setConfirmDelete(false);
    }
  };

  const busy = save.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onPress={onClose} className="-ml-2">
          <Icon icon="lucide:chevron-left" aria-hidden />
          All popups
        </Button>
        <div className="flex-1" />
        {popup && state && (
          <Chip size="sm" variant="soft" color={STATE_META[state].color}>
            {STATE_META[state].label}
          </Chip>
        )}
        {popup && (
          <Button
            variant="danger-soft"
            size="sm"
            onPress={() => setConfirmDelete(true)}
            isDisabled={busy}
          >
            Delete
          </Button>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="border border-separator bg-surface">
            <Card.Content className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Message</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  onPress={() => setPickerOpen(true)}
                >
                  <Icon icon="lucide:layout-template" aria-hidden />
                  {template ? `Template: ${template.name}` : "Use a template"}
                </Button>
              </div>
              <TextField
                isRequired
                isInvalid={!!errors.title}
                value={form.title}
                onChange={(v) => update("title", v)}
              >
                <Label>Title</Label>
                <Input placeholder="e.g. 2027 memberships are open" />
                <Description>
                  {form.title.length} / {HOME_POPUP_TITLE_MAX}
                </Description>
                <FieldError>{errors.title}</FieldError>
              </TextField>
              <MarkdownEditor
                label="Message"
                value={form.body}
                onChange={(v) => update("body", v)}
                placeholder="A sentence or two. Links like [Membership](/membership) open in the app."
                minRows={5}
                error={errors.body}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  isInvalid={!!errors.ctaLabel}
                  value={form.ctaLabel}
                  onChange={(v) => update("ctaLabel", v)}
                >
                  <Label>Button label (optional)</Label>
                  <Input placeholder="e.g. Renew membership" />
                  <FieldError>{errors.ctaLabel}</FieldError>
                </TextField>
                <TextField
                  isInvalid={!!errors.ctaLink}
                  value={form.ctaLink}
                  onChange={(v) => update("ctaLink", v)}
                >
                  <Label>Button link</Label>
                  <Input placeholder="/membership" inputMode="url" />
                  <FieldError>{errors.ctaLink}</FieldError>
                </TextField>
              </div>
            </Card.Content>
          </Card>

          <Card className="border border-separator bg-surface">
            <Card.Content className="flex flex-col gap-4 p-4 sm:p-5">
              <h3 className="text-base font-semibold">Who sees it</h3>
              <Segment
                aria-label="Audience"
                size="lg"
                selectedKey={form.audience}
                onSelectionChange={(key) => {
                  if (isAudience(key)) update("audience", key);
                }}
                className="w-full"
              >
                <Segment.Item id={HOME_POPUP_AUDIENCE.EVERYONE} className="h-11 flex-1">
                  Everyone
                </Segment.Item>
                <Segment.Item id={HOME_POPUP_AUDIENCE.MEMBERS} className="h-11 flex-1">
                  Members
                </Segment.Item>
                <Segment.Item id={HOME_POPUP_AUDIENCE.VISITORS} className="h-11 flex-1">
                  Visitors
                </Segment.Item>
              </Segment>
              <p className="text-sm text-muted">{AUDIENCE_HELP[form.audience]}</p>
              {isPublished && (
                <Checkbox
                  id="home-popup-show-again"
                  isSelected={showAgain}
                  onChange={setShowAgain}
                  className="min-h-11"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label htmlFor="home-popup-show-again" className="text-sm">
                      Show again to people who dismissed it
                      <span className="block text-muted">
                        For a big change. Typo fixes don&apos;t need it.
                      </span>
                    </Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
            </Card.Content>
          </Card>

          <Card className="border border-separator bg-surface">
            <Card.Content className="flex flex-col gap-4 p-4 sm:p-5">
              <h3 className="text-base font-semibold">When</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateOnlyPicker
                  label="Starts"
                  value={form.startYmd}
                  onChange={(v) => {
                    // An end date still on its default follows the start.
                    if (v && form.startYmd && form.endYmd === defaultEndYmd(form.startYmd)) {
                      update("endYmd", defaultEndYmd(v));
                    }
                    update("startYmd", v);
                  }}
                  error={errors.startYmd}
                  isRequired
                />
                <DateOnlyPicker
                  label="Ends (optional)"
                  value={form.endYmd}
                  onChange={(v) => update("endYmd", v)}
                  error={errors.endYmd}
                />
              </div>
              <p className="text-sm text-muted">
                New popups end {HOME_POPUP_DEFAULT_DAYS} days after they start;
                clear the end date to keep one up. If more than one popup is
                live, the most recently published one shows.
              </p>
            </Card.Content>
          </Card>

          {popup?.publishedAt && <HomePopupResponses popup={popup} />}

          <Button
            variant="outline"
            className="h-12 sm:hidden"
            onPress={() => void handlePreview()}
            isDisabled={busy}
          >
            <Icon icon="lucide:eye" aria-hidden />
            Preview on this page
          </Button>
        </div>

        <aside className="sticky top-16 hidden flex-col gap-2 lg:flex">
          <span className="text-xs text-muted">Preview</span>
          <div className="rounded-2xl bg-foreground/30 p-4">
            <HomePopupPreviewCard popup={form} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Chip size="sm" variant="soft">
              {audienceLabel(form.audience)}
            </Chip>
            Home page · once per person
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:px-0">
        <Button
          variant="outline"
          className="hidden sm:inline-flex"
          onPress={() => void handlePreview()}
          isDisabled={busy}
        >
          <Icon icon="lucide:eye" aria-hidden />
          Preview on this page
        </Button>
        <span className="hidden flex-1 text-sm text-muted sm:block">
          {lastSaved &&
            `Saved ${lastSaved.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
        </span>
        <Button
          variant="secondary"
          className="h-12 flex-1 sm:h-10 sm:flex-none"
          onPress={() => void handleSaveDraft()}
          isDisabled={busy}
        >
          {isPublished ? "Unpublish" : "Save draft"}
        </Button>
        <Button
          className="h-12 flex-1 sm:h-10 sm:flex-none"
          onPress={() => void handlePublish()}
          isPending={save.isPending}
          isDisabled={busy}
        >
          {isPublished ? "Save changes" : "Publish"}
        </Button>
      </div>

      <HomePopupDialog
        popup={form}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        preview
      />

      <HomePopupTemplatePicker
        isOpen={pickerOpen}
        initialId={form.templateId || undefined}
        onClose={() => setPickerOpen(false)}
        onSelect={(t) => {
          const next = formFromTemplate(t);
          // Keep the dates the admin already chose.
          setForm((prev) => ({ ...next, startYmd: prev.startYmd, endYmd: prev.endYmd }));
          setErrors({});
          setPickerOpen(false);
        }}
      />

      <Modal.Backdrop
        isOpen={confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(false)}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold">
                Delete this popup?
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="text-sm">
              {isPublished
                ? "It comes off the home page straight away. This can't be undone."
                : "This can't be undone."}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => void handleDelete()}
                isPending={remove.isPending}
              >
                Delete
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
