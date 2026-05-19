import {
  Button,
  Modal,
  Form,
  Label,
  ListBox,
  Select,
  DatePicker,
} from "@heroui/react";
import type { Placement } from "react-aria-components";
type PopoverProps = {
  portalContainer?: HTMLElement;
  containerPadding?: number;
  placement?: Placement;
  shouldFlip?: boolean;
  offset?: number;
};
import { Icon } from "@iconify/react";
import { type DateValue, parseDate } from "@internationalized/date";
import { toYMD } from "@/api/find-a-game";
import { useCallback, useState } from "react";

export type Mode = "needPlayers" | "needGroup";

export interface FindAGamePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  date: string;
  onDateChange: (d: string) => void;
  time: string;
  onTimeChange: (t: string) => void;
  openSpots: string;
  onOpenSpotsChange: (s: string) => void;
  canSubmit: boolean;
  creating: boolean;
  onSubmit: () => Promise<void> | void;
  title?: string;
  submitLabel?: string;
}

export default function FindAGamePostModal({
  isOpen,
  onClose,
  mode,
  onModeChange,
  date,
  onDateChange,
  time,
  onTimeChange,
  openSpots,
  onOpenSpotsChange,
  canSubmit,
  creating: _creating,
  onSubmit,
  title,
  submitLabel,
}: FindAGamePostModalProps) {
  // When used inside a modal, Select/DatePicker popovers must render *within* the modal subtree.
  // Otherwise, the modal's aria-hide-outside behavior can mark the focused option as aria-hidden,
  // triggering the browser warning about hiding focused descendants.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  const setPortalRef = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node);
  }, []);

  const popoverProps = useCallback((): Partial<PopoverProps> => {
    return {
      portalContainer: portalContainer ?? undefined,
      // Keep overlays within the modal viewport.
      containerPadding: 12,
    };
  }, [portalContainer]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container scroll="inside">
          <Modal.Dialog>
            <div ref={setPortalRef} />
            <Modal.Header className="flex flex-col gap-1">
              <div className="text-lg font-semibold">
                {title || "Create Post"}
              </div>
            </Modal.Header>
            <Modal.Body>
              <Form
                className="flex flex-col gap-3"
                validationBehavior="native"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await onSubmit();
                }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={mode}
                    onChange={(key) => {
                      if (key) onModeChange(key as Mode);
                    }}
                    className="min-w-[220px] w-60"
                  >
                    <Label>Post Type</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover {...popoverProps()}>
                      <ListBox>
                        <ListBox.Item id="needPlayers" textValue="Need Players">
                          <Icon icon="lucide:user-plus" className="w-4 h-4" />
                          Need Players
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="needGroup" textValue="Need a Group">
                          <Icon icon="lucide:users" className="w-4 h-4" />
                          Need a Group
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <DatePicker
                    label="Date"
                    value={date ? parseDate(date) : null}
                    onChange={(v: DateValue | null) =>
                      onDateChange(v ? v.toString() : "")
                    }
                    minValue={parseDate(toYMD(new Date()))}
                    popoverProps={{
                      ...popoverProps(),
                      placement: "bottom",
                      shouldFlip: false,
                      offset: 8,
                    }}
                    className="w-48"
                    classNames={{
                      // Keep the calendar within the modal/screen on small devices.
                      popoverContent: "max-w-[90vw] max-h-[55vh] overflow-auto",
                      calendarContent: "max-w-[90vw]",
                    }}
                    isRequired
                  />

                  {mode === "needPlayers" && (
                    <>
                      <div className="flex flex-col gap-1 w-40">
                        <span className="text-sm">Tee Time</span>
                        <input
                          type="time"
                          value={time || ""}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onTimeChange(e.target.value)
                          }
                          className="w-40 rounded border p-1 text-sm"
                        />
                      </div>
                      <Select
                        value={openSpots}
                        onChange={(key) =>
                          onOpenSpotsChange(String(key || "1"))
                        }
                        className="w-36"
                      >
                        <Label>Open Spots</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover {...popoverProps()}>
                          <ListBox>
                            <ListBox.Item id="1" textValue="1">
                              1<ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="2" textValue="2">
                              2<ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="3" textValue="3">
                              3<ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </>
                  )}
                </div>

                <Modal.Footer className="flex items-center justify-between w-full">
                  <Button variant="tertiary" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button isDisabled={!canSubmit} type="submit">
                    {submitLabel || "Post"}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
