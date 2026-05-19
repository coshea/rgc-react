import React from "react";
import { Card, Button, Checkbox, Tooltip } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { Icon } from "@iconify/react";
import { User } from "@/api/users";
import RegistrationEditor from "@/components/registration-editor";

type Registration = {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string; displayName?: string; goldTee?: boolean }>;
  openSpotsOptIn?: boolean;
};

interface Props {
  registrations: Registration[];
  users: User[];
  players: number;
  editingId: string | null;
  onStartEdit: (reg: Registration) => void;
  onCancelEdit: () => void;
  onSave: (
    regId: string,
    ids: string[],
    openSpotsOptIn: boolean,
    goldTees: string[],
  ) => void;
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
    {},
  );
  const [localOpenSpots, setLocalOpenSpots] = React.useState<
    Record<string, boolean>
  >({});
  const [localGoldTees, setLocalGoldTees] = React.useState<
    Record<string, string[]>
  >({});

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
      const u = users.find((x) => x.id === m.id);
      return u?.displayName || m.displayName || m.id || "(unknown)";
    });
  }, [selectedRegistration, users]);

  const startEditing = (reg: Registration) => {
    const ids = Array.isArray(reg.team)
      ? reg.team.map((m) => m.id || "")
      : [""];
    const goldIds = Array.isArray(reg.team)
      ? reg.team.filter((m) => m.goldTee).map((m) => m.id)
      : [];
    setLocalTeams((s) => ({ ...s, [reg.id]: ids }));
    setLocalOpenSpots((s) => ({
      ...s,
      [reg.id]: reg.openSpotsOptIn === true,
    }));
    setLocalGoldTees((s) => ({ ...s, [reg.id]: goldIds }));
    onStartEdit(reg);
  };

  const updateLocal = (regId: string, ids: string[]) => {
    setLocalTeams((s) => ({ ...s, [regId]: ids }));
  };

  const updateOpenSpots = (regId: string, value: boolean) => {
    setLocalOpenSpots((s) => ({ ...s, [regId]: value }));
  };

  return (
    <div className="space-y-3">
      {registrations.map((reg) => {
        const isEditing = editingId === reg.id;
        const team = Array.isArray(reg.team) ? reg.team : [];
        const local = (localTeams[reg.id] ?? team.map((m) => m.id || "")) || [
          "",
        ];
        const openSpotsValue =
          localOpenSpots[reg.id] ?? reg.openSpotsOptIn === true;

        return (
          <Card key={reg.id} className="p-3">
            <Card.Content>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {team.map((m, i) => {
                      const memberUser = users.find((u) => u.id === m.id);
                      // Pass full user when available for centralized fallback (profileURL > photoURL > initials)
                      const label = (m.displayName || m.id || "").toString();
                      return (
                        <UserAvatar
                          key={m.id || i}
                          size="sm"
                          user={memberUser}
                          name={memberUser ? undefined : label}
                          alt={label}
                          className="border"
                        />
                      );
                    })}
                  </div>

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
                      <div className="bg-background dark:bg-default/60 rounded-lg p-6 w-full max-w-md z-10">
                        <h3 className="text-lg font-medium mb-2">
                          Remove registration
                        </h3>
                        <p className="text-sm text-muted mb-4">
                          Are you sure you want to remove this registration?
                          This cannot be undone.
                        </p>
                        {selectedRegistration && (
                          <div className="text-sm text-muted mb-4">
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
                            variant="tertiary"
                            onPress={() => {
                              setConfirmOpen(false);
                              setDeletingId(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
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
                      <Tooltip closeDelay={0}>
                        <Tooltip.Trigger>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() =>
                              onSave(
                                reg.id,
                                (localTeams[reg.id] || []).filter(Boolean),
                                openSpotsValue,
                                localGoldTees[reg.id] ?? [],
                              )
                            }
                            aria-label="Save registration"
                          >
                            <Icon icon="lucide:save" className="w-4 h-4" />
                            <span className="hidden sm:inline">Save</span>
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="top" offset={6}>
                          Save
                        </Tooltip.Content>
                      </Tooltip>
                      <Tooltip closeDelay={0}>
                        <Tooltip.Trigger>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => onCancelEdit()}
                            aria-label="Cancel editing"
                          >
                            <Icon icon="lucide:x" className="w-4 h-4" />
                            <span className="hidden sm:inline">Cancel</span>
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="top" offset={6}>
                          Cancel
                        </Tooltip.Content>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip closeDelay={0}>
                        <Tooltip.Trigger>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => startEditing(reg)}
                            aria-label="Edit registration"
                          >
                            <Icon icon="lucide:edit" className="w-4 h-4" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="top" offset={6}>
                          Edit
                        </Tooltip.Content>
                      </Tooltip>
                      <Tooltip closeDelay={0}>
                        <Tooltip.Trigger>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => {
                              setDeletingId(reg.id);
                              setConfirmOpen(true);
                            }}
                            aria-label="Delete registration"
                          >
                            <Icon icon="lucide:trash-2" className="w-4 h-4" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement="top" offset={6}>
                          Delete
                        </Tooltip.Content>
                      </Tooltip>
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
                    goldTees={localGoldTees[reg.id] ?? []}
                    onGoldTeesChange={(ids) =>
                      setLocalGoldTees((s) => ({ ...s, [reg.id]: ids }))
                    }
                  />
                  {players > 1 ? (
                    <div className="mt-3">
                      <Checkbox
                        isSelected={openSpotsValue}
                        onValueChange={(v) => updateOpenSpots(reg.id, v)}
                      >
                        {players === 2
                          ? "Looking for a partner team / open to new players"
                          : "Let others contact this team to fill open spots"}
                      </Checkbox>
                    </div>
                  ) : null}
                </div>
              )}
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
};

export default RegistrationsList;
