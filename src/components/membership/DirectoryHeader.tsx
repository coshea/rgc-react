import { Button, Chip } from "@heroui/react";
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
    <div className="mb-4 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-semibold leading-tight">
        Membership Directory
      </h1>
      {(isAdminOrBoard || isAdmin) && (
        <div className="flex flex-wrap gap-2 justify-end items-center">
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
                <Button
                  size="sm"
                  variant="flat"
                  startContent={
                    <Icon icon="lucide:download" className="w-4 h-4" />
                  }
                  onPress={onExportMembers}
                  isDisabled={members.length === 0}
                  className="font-medium"
                >
                  Export
                </Button>
              )}
            </div>
          )}
          {/* Admin only: find duplicates + add member */}
          {isAdmin && (
            <div className="flex items-center gap-2 pl-2 border-l border-divider">
              <Chip color="secondary" size="sm" variant="flat">
                Admin only
              </Chip>
              {onFindDuplicates && (
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  startContent={
                    <Icon icon="lucide:users" className="w-4 h-4" />
                  }
                  onPress={onFindDuplicates}
                  className="font-medium"
                >
                  Find Duplicates
                </Button>
              )}
              <Button
                size="sm"
                color="primary"
                startContent={<PlusIcon className="w-4 h-4" />}
                onPress={onAdd}
                className="font-medium"
              >
                Add Member
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
