import { Button, Input, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";

export type Mode = "needPlayers" | "needGroup";

export interface CreateControlsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  date: string;
  onDateChange: (date: string) => void;
  minDate: string;
  time: string;
  onTimeChange: (t: string) => void;
  openSpots: string;
  onOpenSpotsChange: (s: string) => void;
  canSubmit: boolean;
  creating: boolean;
  onSubmit: () => void;
}

export function CreateControls(props: CreateControlsProps) {
  const {
    mode,
    onModeChange,
    date,
    onDateChange,
    minDate,
    time,
    onTimeChange,
    openSpots,
    onOpenSpotsChange,
    canSubmit,
    creating,
    onSubmit,
  } = props;

  return (
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
          startContent={<Icon icon="lucide:user-plus" className="w-4 h-4" />}
        >
          Need Players
        </SelectItem>
        <SelectItem
          key="needGroup"
          textValue="Need a Group"
          startContent={<Icon icon="lucide:users" className="w-4 h-4" />}
        >
          Need a Group
        </SelectItem>
      </Select>

      <Input
        type="date"
        label="Date"
        value={date}
        onValueChange={onDateChange}
        className="w-44"
        min={minDate}
      />

      {mode === "needPlayers" && (
        <>
          <Input
            type="time"
            label="Tee Time"
            value={time}
            onValueChange={onTimeChange}
            className="w-36"
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

      <Button
        color="primary"
        onPress={onSubmit}
        isDisabled={!canSubmit}
        isLoading={creating}
      >
        Post
      </Button>
    </div>
  );
}

export default CreateControls;
