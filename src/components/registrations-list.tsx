import React from "react";
import {
  Card,
  CardBody,
  Avatar,
  AvatarGroup,
  Button,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { User } from "@/api/users";

type Registration = {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string; displayName?: string }>;
};

interface Props {
  registrations: Registration[];
  users: User[];
  players: number;
  editingId: string | null;
  onStartEdit: (reg: Registration) => void;
  onCancelEdit: () => void;
  onSave: (regId: string, ids: string[]) => void;
  onDelete: (regId: string) => void;
}

export const RegistrationsList: React.FC<Props> = ({
  registrations,
  users,
  players,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}) => {
  const [localTeams, setLocalTeams] = React.useState<Record<string, string[]>>(
    {}
  );

  const startEditing = (reg: Registration) => {
    const ids = Array.isArray(reg.team)
      ? reg.team.map((m) => m.id || "")
      : [""];
    setLocalTeams((s) => ({ ...s, [reg.id]: ids }));
    onStartEdit(reg);
  };

  const updateSlot = (
    regId: string,
    index: number,
    value: string | undefined
  ) => {
    setLocalTeams((s) => {
      const current = s[regId] ? [...s[regId]] : [""];
      current[index] = value || "";
      return { ...s, [regId]: current };
    });
  };

  const addSlot = (regId: string) => {
    setLocalTeams((s) => {
      const current = s[regId] ? [...s[regId]] : [""];
      if (current.length < players) current.push("");
      return { ...s, [regId]: current };
    });
  };

  const removeSlot = (regId: string, index: number) => {
    setLocalTeams((s) => {
      const current = s[regId] ? [...s[regId]] : [];
      current.splice(index, 1);
      return { ...s, [regId]: current };
    });
  };

  return (
    <div className="space-y-3">
      {registrations.map((reg) => {
        const isEditing = editingId === reg.id;
        const team = Array.isArray(reg.team) ? reg.team : [];
        const local = (localTeams[reg.id] ?? team.map((m) => m.id || "")) || [
          "",
        ];

        return (
          <Card key={reg.id} className="p-3">
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <AvatarGroup isBordered>
                    {team.map((m, i) => {
                      const memberUser = users.find(
                        (u) => u.id === (m as any).id
                      );
                      const src = memberUser
                        ? (memberUser as any).profileURL ||
                          (memberUser as any).photoURL
                        : undefined;
                      const label = (m.displayName || m.id || "").toString();
                      return (
                        <Avatar key={m.id || i} size="sm" src={src} alt={label}>
                          {label
                            .split(" ")
                            .map((s: string) => s[0])
                            .join("")}
                        </Avatar>
                      );
                    })}
                  </AvatarGroup>

                  <div>
                    <div className="text-sm font-medium">
                      {team.map((m) => m.displayName || m.id).join(", ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        color="primary"
                        onPress={() =>
                          onSave(
                            reg.id,
                            (localTeams[reg.id] || []).filter(Boolean)
                          )
                        }
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        onPress={() => onCancelEdit()}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onPress={() => startEditing(reg)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="light"
                        onPress={() => onDelete(reg.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 space-y-2">
                  {(local || []).map((uid, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          label={
                            idx === 0 ? "Team Leader" : `Teammate ${idx + 1}`
                          }
                          placeholder="Select user"
                          selectionMode="single"
                          selectedKeys={uid ? new Set([uid]) : new Set()}
                          onSelectionChange={(keys) => {
                            const selected = Array.from(
                              keys as Set<string>
                            )[0] as string | undefined;
                            updateSlot(reg.id, idx, selected);
                          }}
                          className="w-full"
                        >
                          {users.map((u) => (
                            <SelectItem key={u.id}>
                              {u.displayName || u.email || u.id}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>

                      <div className="flex items-center gap-1">
                        {local.length > 1 && (
                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => removeSlot(reg.id, idx)}
                          >
                            <Icon icon="lucide:trash-2" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => addSlot(reg.id)}
                      isDisabled={(local || []).length >= players}
                    >
                      Add Teammate
                    </Button>
                    <div className="text-sm text-foreground-500">
                      {(local || []).length}/{players}
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
};

export default RegistrationsList;
