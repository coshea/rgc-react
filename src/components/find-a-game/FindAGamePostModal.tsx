import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Form,
  Select,
  SelectItem,
  DatePicker,
  TimeInput,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { type DateValue, parseDate, parseTime } from "@internationalized/date";
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
  creating,
  onSubmit,
  title,
  submitLabel,
}: FindAGamePostModalProps) {
  // When used inside a modal, Select/DatePicker popovers must render *within* the modal subtree.
  // Otherwise, the modal's aria-hide-outside behavior can mark the focused option as aria-hidden,
  // triggering the browser warning about hiding focused descendants.
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  const setPortalRef = useCallback((node: HTMLDivElement | null) => {
    setPortalContainer(node);
  }, []);

  const popoverProps = useCallback(
    () => ({ portalContainer: portalContainer ?? undefined }),
    [portalContainer]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <div ref={setPortalRef} />
        <ModalHeader className="flex flex-col gap-1">
          <div className="text-lg font-semibold">{title || "Create Post"}</div>
        </ModalHeader>
        <ModalBody>
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
                label="Post Type"
                selectedKeys={[mode]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as Mode;
                  onModeChange(v);
                }}
                popoverProps={popoverProps()}
                className="min-w-[220px] w-60"
              >
                <SelectItem
                  key="needPlayers"
                  textValue="Need Players"
                  startContent={
                    <Icon icon="lucide:user-plus" className="w-4 h-4" />
                  }
                >
                  Need Players
                </SelectItem>
                <SelectItem
                  key="needGroup"
                  textValue="Need a Group"
                  startContent={
                    <Icon icon="lucide:users" className="w-4 h-4" />
                  }
                >
                  Need a Group
                </SelectItem>
              </Select>

              <DatePicker
                label="Date"
                value={date ? parseDate(date) : null}
                onChange={(v: DateValue | null) =>
                  onDateChange(v ? v.toString() : "")
                }
                minValue={parseDate(toYMD(new Date()))}
                popoverProps={popoverProps()}
                className="w-48"
                isRequired
              />

              {mode === "needPlayers" && (
                <>
                  <TimeInput
                    label="Tee Time"
                    value={time ? parseTime(time) : null}
                    onChange={(v) => onTimeChange(v ? v.toString() : "")}
                    granularity="minute"
                    hourCycle={12}
                    className="w-40"
                  />
                  <Select
                    label="Open Spots"
                    selectedKeys={[openSpots]}
                    onSelectionChange={(keys) =>
                      onOpenSpotsChange(String(Array.from(keys)[0] || "1"))
                    }
                    popoverProps={popoverProps()}
                    className="w-36"
                  >
                    <SelectItem key="1">1</SelectItem>
                    <SelectItem key="2">2</SelectItem>
                    <SelectItem key="3">3</SelectItem>
                  </Select>
                </>
              )}
            </div>

            <ModalFooter className="flex items-center justify-between w-full">
              <Button variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                isDisabled={!canSubmit}
                isLoading={creating}
                type="submit"
              >
                {submitLabel || "Post"}
              </Button>
            </ModalFooter>
          </Form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
