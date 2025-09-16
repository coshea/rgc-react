import React from "react";
import { Card, CardBody, Avatar, AvatarGroup, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { User } from "@/api/users";
import RegistrationEditor from "@/components/registration-editor";

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
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [localTeams, setLocalTeams] = React.useState<Record<string, string[]>>(
    {}
  );

  const selectedRegistration = React.useMemo(() => {
    return registrations.find((r) => r.id === deletingId) || null;
  }, [registrations, deletingId]);

  const ownerUser = React.useMemo(() => {
    if (!selectedRegistration || !selectedRegistration.ownerId) return null;
    return users.find((u) => u.id === selectedRegistration.ownerId) || null;
  }, [selectedRegistration, users]);

  const teamMemberNames = React.useMemo(() => {
    if (!selectedRegistration || !Array.isArray(selectedRegistration.team))
      return [] as string[];
    return selectedRegistration.team.map((m) => {
      const u = users.find((x) => x.id === (m as any).id);
      return (
        u?.displayName || (m as any).displayName || (m as any).id || "(unknown)"
      );
    });
  }, [selectedRegistration, users]);

  const startEditing = (reg: Registration) => {
    const ids = Array.isArray(reg.team)
      ? reg.team.map((m) => m.id || "")
      : [""];
    setLocalTeams((s) => ({ ...s, [reg.id]: ids }));
    onStartEdit(reg);
  };

  const updateLocal = (regId: string, ids: string[]) => {
    setLocalTeams((s) => ({ ...s, [regId]: ids }));
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

                  {/* Confirmation modal (in-app) */}
                  {confirmOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                      <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => {
                          setConfirmOpen(false);
                          setDeletingId(null);
                        }}
                      />
                      <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-md z-10">
                        <h3 className="text-lg font-medium mb-2">
                          Remove registration
                        </h3>
                        <p className="text-sm text-foreground-500 mb-4">
                          Are you sure you want to remove this registration?
                          This cannot be undone.
                        </p>
                        {selectedRegistration && (
                          <div className="text-sm text-foreground-500 mb-4">
                            <p className="font-medium">Owner:</p>
                            <p>
                              {ownerUser
                                ? ownerUser.displayName || ownerUser.email
                                : selectedRegistration.ownerId}
                            </p>
                            <p className="font-medium mt-2">Team:</p>
                            <p>{teamMemberNames.join(", ")}</p>
                          </div>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="flat"
                            onPress={() => {
                              setConfirmOpen(false);
                              setDeletingId(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            color="danger"
                            onPress={() => {
                              if (deletingId) onDelete(deletingId);
                              setConfirmOpen(false);
                              setDeletingId(null);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
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
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => startEditing(reg)}
                        startContent={
                          <Icon icon="lucide:edit" className="w-4 h-4" />
                        }
                        aria-label="Edit registration"
                      >
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => {
                          setDeletingId(reg.id);
                          setConfirmOpen(true);
                        }}
                        startContent={
                          <Icon icon="lucide:trash-2" className="w-4 h-4" />
                        }
                        aria-label="Delete registration"
                      >
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-3">
                  <RegistrationEditor
                    value={local}
                    onChange={(ids) => updateLocal(reg.id, ids)}
                    users={users}
                    maxSize={players}
                  />
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
