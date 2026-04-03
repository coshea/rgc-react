import { useState, useRef } from "react";
import { Button, Chip, Switch, Tooltip } from "@heroui/react";
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
  activeOnly?: boolean;
  onActiveOnlyChange?: (value: boolean) => void;
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
  activeOnly = true,
  onActiveOnlyChange,
}: DirectoryHeaderProps) {
  const [adminOpen, setAdminOpen] = useState(false);
  const buttonsRef = useRef<HTMLDivElement>(null);

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
              <Tooltip content="Email active members">
                <div>
                  <EmailMembersButton
                    members={members}
                    activeSet={activeSet}
                    currentYear={currentYear}
                    size="sm"
                  />
                </div>
              </Tooltip>
              {onExportMembers && (
                <Tooltip content="Export member list to CSV">
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
                </Tooltip>
              )}
            </div>
          )}
          {/* Admin only: horizontal drawer triggered by the chip */}
          {isAdmin && (
            <div className="flex items-center gap-2 pl-2 border-l border-divider">
              <button
                onClick={() => setAdminOpen((o) => !o)}
                aria-expanded={adminOpen}
                aria-label="Toggle admin actions"
                className="focus:outline-none"
              >
                <Chip
                  color="secondary"
                  size="sm"
                  variant="flat"
                  className="cursor-pointer select-none"
                  endContent={
                    <Icon
                      icon="lucide:chevron-right"
                      className={`w-3 h-3 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                    />
                  }
                >
                  Admin only
                </Chip>
              </button>
              {/* Horizontal sliding drawer */}
              <div
                className="flex items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                style={{
                  maxWidth: adminOpen
                    ? `${buttonsRef.current?.scrollWidth ?? 400}px`
                    : "0px",
                  opacity: adminOpen ? 1 : 0,
                }}
              >
                <div ref={buttonsRef} className="flex items-center gap-2">
                  {onActiveOnlyChange && (
                    <Switch
                      size="sm"
                      isSelected={activeOnly}
                      onValueChange={onActiveOnlyChange}
                      aria-label="Toggle active members only"
                      className="whitespace-nowrap"
                    >
                      Active Last 2 Years
                    </Switch>
                  )}
                  {onFindDuplicates && (
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      startContent={
                        <Icon icon="lucide:users" className="w-4 h-4" />
                      }
                      onPress={onFindDuplicates}
                      className="font-medium whitespace-nowrap"
                    >
                      Find Duplicates
                    </Button>
                  )}
                  <Button
                    size="sm"
                    color="primary"
                    startContent={<PlusIcon className="w-4 h-4" />}
                    onPress={onAdd}
                    className="font-medium whitespace-nowrap"
                  >
                    Add Member
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
