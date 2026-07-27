import { Button, Tooltip } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { Icon } from "@iconify/react";

import type { User } from "@/api/users";
import { EmailMembersButton } from "./EmailMembersButton";

interface DirectoryHeaderProps {
  isAdmin: boolean;
  isAdminOrBoard: boolean;
  onAdd: () => void;
  onFindDuplicates?: () => void;
  onExportMembers?: () => void;
  members?: User[];
  activeSet?: Set<string>;
  currentYear?: number;
}

export function DirectoryHeader({
  isAdmin,
  isAdminOrBoard,
  onAdd,
  onFindDuplicates,
  onExportMembers,
  members = [],
  activeSet = new Set(),
  currentYear = new Date().getFullYear(),
}: DirectoryHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      {/* ── Title row ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold leading-tight">
          Membership Directory
        </h1>
      </div>

      {/* ── Mobile layout (hidden sm+) ── */}
      {(isAdminOrBoard || isAdmin) && (
        <div className="flex flex-col gap-2 sm:hidden">
          {/* Board actions: Email + Export */}
          {isAdminOrBoard && (
            <div className="flex gap-2">
              <EmailMembersButton
                members={members}
                activeSet={activeSet}
                currentYear={currentYear}
                size="sm"
              />
              {onExportMembers && (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={onExportMembers}
                  isDisabled={members.length === 0}
                  className="font-medium"
                >
                  <Icon icon="lucide:download" className="w-4 h-4" />
                  Export
                </Button>
              )}
            </div>
          )}

          {/* Admin-only actions row */}
          {isAdmin && (
            <div className="grid grid-cols-2 gap-2">
              {onFindDuplicates && (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={onFindDuplicates}
                  className="font-medium w-full"
                >
                  <Icon icon="lucide:users" className="w-4 h-4" />
                  Find Duplicates
                </Button>
              )}
              <Button size="sm" onPress={onAdd} className="font-medium w-full">
                <PlusIcon className="w-4 h-4" />
                Add Member
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Desktop layout (hidden on mobile) ── */}
      {(isAdminOrBoard || isAdmin) && (
        <div className="hidden sm:flex flex-wrap gap-2 justify-end items-center">
          {/* Admin or board: email + export */}
          {isAdminOrBoard && (
            <div className="flex gap-2 items-center">
              <EmailMembersButton
                members={members}
                activeSet={activeSet}
                currentYear={currentYear}
                size="sm"
              />
              {onExportMembers && (
                <Tooltip>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={onExportMembers}
                    isDisabled={members.length === 0}
                    className="font-medium"
                  >
                    <Icon icon="lucide:download" className="w-4 h-4" />
                    Export
                  </Button>
                  <Tooltip.Content>Export member list to CSV</Tooltip.Content>
                </Tooltip>
              )}
            </div>
          )}
          {/* Admin only: direct actions */}
          {isAdmin && (
            <div className="flex items-center gap-2 pl-2 border-l border-divider">
              {onFindDuplicates && (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={onFindDuplicates}
                  className="font-medium whitespace-nowrap"
                >
                  <Icon icon="lucide:users" className="w-4 h-4" />
                  Find Duplicates
                </Button>
              )}
              <Button
                size="sm"
                onPress={onAdd}
                className="font-medium whitespace-nowrap"
              >
                <PlusIcon className="w-4 h-4" />
                Add Member
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
