import React from "react";
import { Button, Separator, Checkbox, Label } from "@heroui/react";
import { Icon } from "@iconify/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { User } from "@/api/users";
import RegistrationEditor from "@/components/registration-editor";
import RegistrationsList, {
  Registration,
} from "@/components/registrations-list";

interface RegistrationsSectionProps {
  regsOpen: boolean;
  setRegsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  regsLoading: boolean;
  registrations: Registration[];
  allUsers: User[];
  activeUsers: User[];
  players: number;
  editingRegId: string | null;
  onStartEdit: (reg: Registration) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    regId: string,
    ids: string[],
    openSpotsOptIn: boolean,
    goldTees: string[],
  ) => Promise<void>;
  onDelete: (regId: string) => Promise<void>;
  newMembers: string[];
  setNewMembers: (v: string[]) => void;
  newOpenSpotsOptIn: boolean;
  setNewOpenSpotsOptIn: (v: boolean) => void;
  adding: boolean;
  onSubmitNewRegistration: () => Promise<void>;
}

export const RegistrationsSection: React.FC<RegistrationsSectionProps> = ({
  regsOpen,
  setRegsOpen,
  addOpen,
  setAddOpen,
  regsLoading,
  registrations,
  allUsers,
  activeUsers,
  players,
  editingRegId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  newMembers,
  setNewMembers,
  newOpenSpotsOptIn,
  setNewOpenSpotsOptIn,
  adding,
  onSubmitNewRegistration,
}) => {
  return (
    <div className="pt-6">
      <Separator className="my-4" />
      <button
        type="button"
        onClick={() => setRegsOpen((o) => !o)}
        aria-expanded={regsOpen}
        className="w-full flex items-center justify-between py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <h3 className="text-lg font-medium">Registrations</h3>
        <Icon
          icon="lucide:chevron-down"
          className={`w-5 h-5 text-muted transition-transform duration-200 ${regsOpen ? "rotate-180" : ""}`}
        />
      </button>
      {regsOpen && (
        <div className="pt-2">
          <div className="mb-4 flex items-center gap-3">
            <Button size="sm" onPress={() => setAddOpen(true)}>
              <PlusIcon className="w-4 h-4" />
              Add Registration
            </Button>
            <div className="text-xs text-muted">Team size: {players}</div>
          </div>
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
              onSave={onSaveEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      )}

      {/* Add Registration Dialog */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!adding) {
                setAddOpen(false);
                setNewMembers([""]);
              }
            }}
          />
          <div className="bg-background dark:bg-default/60 rounded-lg p-6 w-full max-w-lg z-10">
            <h3 className="text-lg font-medium mb-2">Add Registration</h3>
            <RegistrationEditor
              value={newMembers}
              onChange={setNewMembers}
              users={activeUsers}
              maxSize={players}
              disableAutoSelect={true}
            />
            {players > 1 ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  isSelected={newOpenSpotsOptIn}
                  onChange={setNewOpenSpotsOptIn}
                  id="new-open-spots-opt-in"
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
                <Label
                  htmlFor="new-open-spots-opt-in"
                  className="cursor-pointer"
                >
                  Let others contact this team to fill open spots
                </Label>
              </div>
            ) : null}
            <div className="h-4" />
            <div className="flex justify-end gap-2">
              <Button
                variant="tertiary"
                onPress={() => {
                  if (!adding) {
                    setAddOpen(false);
                    setNewMembers([""]);
                    setNewOpenSpotsOptIn(false);
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
