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
import { parseDate, parseTime } from "@internationalized/date";
import { toYMD } from "@/api/find-a-game";

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
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
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
                className="min-w-[220px] w-[240px]"
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
                value={date ? (parseDate(date) as any) : null}
                onChange={(v) => onDateChange(v ? v.toString() : "")}
                minValue={parseDate(toYMD(new Date()))}
                className="w-48"
                isRequired
              />

              {mode === "needPlayers" && (
                <>
                  <TimeInput
                    label="Tee Time"
                    value={time ? (parseTime(time) as any) : null}
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
