import React from "react";
import { Separator, Button, Checkbox } from "@heroui/react";
import { Label } from "react-aria-components";
import { Icon } from "@iconify/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import RegistrationEditor from "@/components/registration-editor";
import RegistrationsList from "@/components/registrations-list";
import type { User } from "@/api/users";
import type { TournamentRegistration } from "./types";

type SaveRegistrationFn = (
  regId: string,
  memberIds: string[],
  openSpotsOptIn: boolean,
  goldTees: string[],
) => Promise<void>;

interface RegistrationsSectionProps {
  isOpen: boolean;
  onToggle: () => void;
  registrations: TournamentRegistration[];
  regsLoading: boolean;
  allUsers: User[];
  activeUsers: User[];
  players: number;
  isAdmin: boolean;
  editingRegId: string | null;
  onStartEdit: (reg: TournamentRegistration) => void;
  onCancelEdit: () => void;
  onSaveRegistration: SaveRegistrationFn;
  onDeleteRegistration: (regId: string) => Promise<void>;
  addOpen: boolean;
  onOpenAdd: () => void;
  onCloseAdd: () => void;
  newMembers: string[];
  onNewMembersChange: (v: string[]) => void;
  newOpenSpotsOptIn: boolean;
  onNewOpenSpotsOptInChange: (v: boolean) => void;
  adding: boolean;
  onSubmitNewRegistration: () => Promise<void>;
}

export const RegistrationsSection: React.FC<RegistrationsSectionProps> = ({
  isOpen,
  onToggle,
  registrations,
  regsLoading,
  allUsers,
  activeUsers,
  players,
  isAdmin,
  editingRegId,
  onStartEdit,
  onCancelEdit,
  onSaveRegistration,
  onDeleteRegistration,
  addOpen,
  onOpenAdd,
  onCloseAdd,
  newMembers,
  onNewMembersChange,
  newOpenSpotsOptIn,
  onNewOpenSpotsOptInChange,
  adding,
  onSubmitNewRegistration,
}) => {
  return (
    <div className="pt-6">
      <Separator className="my-4" />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <h3 className="text-lg font-medium">Registrations</h3>
        <Icon
          icon="lucide:chevron-down"
          className={`w-5 h-5 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="pt-2">
          {isAdmin && (
            <div className="mb-4 flex items-center gap-3">
              <Button size="sm" onPress={onOpenAdd}>
                <PlusIcon className="w-4 h-4" />
                Add Registration
              </Button>
              <div className="text-xs text-muted">Team size: {players}</div>
            </div>
          )}
          {regsLoading ? (
            <div>Loading registrations...</div>
          ) : registrations.length === 0 ? (
            <div className="text-sm text-muted">No registrations yet.</div>
          ) : (
            <RegistrationsList
              registrations={registrations}
              users={allUsers.filter((u) => !u.isMigrated)}
              players={players}
              editingId={editingRegId}
              onStartEdit={(reg) => onStartEdit(reg)}
              onCancelEdit={() => onCancelEdit()}
              onSave={onSaveRegistration}
              onDelete={onDeleteRegistration}
            />
          )}
        </div>
      )}

      {addOpen && isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!adding) {
                onCloseAdd();
                onNewMembersChange([""]);
              }
            }}
          />
          <div className="bg-background dark:bg-default/60 rounded-lg p-6 w-full max-w-lg z-10">
            <h3 className="text-lg font-medium mb-2">Add Registration</h3>
            <RegistrationEditor
              value={newMembers}
              onChange={onNewMembersChange}
              users={activeUsers}
              maxSize={players}
              disableAutoSelect={true}
            />
            {players > 1 ? (
              <Checkbox
                isSelected={newOpenSpotsOptIn}
                onChange={onNewOpenSpotsOptInChange}
                id="new-open-spots-opt-in"
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor="new-open-spots-opt-in">
                    Let others contact this team to fill open spots
                  </Label>
                </Checkbox.Content>
              </Checkbox>
            ) : null}
            <div className="h-4" />
            <div className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={() => {
                  if (!adding) {
                    onCloseAdd();
                    onNewMembersChange([""]);
                    onNewOpenSpotsOptInChange(false);
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onPress={onSubmitNewRegistration}
                isDisabled={newMembers.filter(Boolean).length === 0}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
