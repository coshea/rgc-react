import { Button, Input, Select, SelectItem, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { User } from "@/api/users";

interface PlayerEntry {
  name: string;
  id: string;
  isHistorical: boolean;
}

interface PlayerEntrySectionProps {
  title: string;
  buttonText: string;
  entries: PlayerEntry[];
  users?: User[];
  usersLoading: boolean;
  errors?: {
    names?: string;
    ids?: string;
  };
  required?: boolean;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "name" | "id", value: string) => void;
  onUpdateHistorical: (index: number, isHistorical: boolean) => void;
}

export function PlayerEntrySection({
  title,
  buttonText,
  entries,
  users,
  usersLoading,
  errors,
  required = false,
  onAdd,
  onRemove,
  onUpdate,
  onUpdateHistorical,
}: PlayerEntrySectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {title} {!required && "(Optional)"}
        </h3>
        <Button
          size="sm"
          variant="flat"
          onPress={onAdd}
          startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
        >
          {buttonText}
        </Button>
      </div>

      {entries.map((entry, index) => (
        <div
          key={index}
          className="space-y-3 p-4 border border-default-200 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-medium font-medium">
              {title.slice(0, -1)} {index + 1}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-small text-default-500">Historical</span>
              <Switch
                size="sm"
                isSelected={entry.isHistorical}
                onValueChange={(value) => onUpdateHistorical(index, value)}
              />
            </div>
          </div>

          <div className="flex gap-2 items-start">
            {entry.isHistorical && (
              <Input
                label="Name"
                value={entry.name}
                onValueChange={(value) => onUpdate(index, "name", value)}
                isInvalid={!!errors?.names}
                className="flex-1"
              />
            )}

            {!entry.isHistorical && (
              <Select
                label={`Select ${title.slice(0, -1)}`}
                placeholder={`Select a ${title.toLowerCase().slice(0, -1)}`}
                selectedKeys={entry.id ? [entry.id] : []}
                onSelectionChange={(keys) => {
                  const userId = Array.from(keys)[0] as string;
                  onUpdate(index, "id", userId || "");
                }}
                isLoading={usersLoading}
                className="flex-1"
                aria-label={`Select ${title.toLowerCase().slice(0, -1)} ${index + 1}`}
                disallowEmptySelection={false}
              >
                {users?.map((user) => (
                  <SelectItem key={user.id}>
                    {user.displayName || user.firstName || user.email}
                  </SelectItem>
                )) || []}
              </Select>
            )}

            {/* Only show remove button if there are multiple entries OR if not required */}
            {(entries.length > 1 || !required) && (
              <Button
                isIconOnly
                variant="flat"
                color="danger"
                size="lg"
                onPress={() => onRemove(index)}
              >
                <Icon icon="lucide:trash-2" className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {/* Error messages */}
      {errors?.names && <p className="text-danger text-sm">{errors.names}</p>}
      {errors?.ids && <p className="text-danger text-sm">{errors.ids}</p>}
    </div>
  );
}
