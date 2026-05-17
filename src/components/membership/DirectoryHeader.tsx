import { useState, useRef } from "react";
import { Button, Switch, Tooltip } from "@heroui/react";
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

          {/* Admin-only accordion row */}
          {isAdmin && (
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                
                variant="tertiary"
                onPress={() => setAdminOpen((o) => !o)}
                aria-expanded={adminOpen}
                aria-label="Toggle admin actions"
                className="w-full justify-between font-medium"
                endContent={
                  <Icon
                    icon="lucide:chevron-down"
                    className={`w-4 h-4 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                  />
                }
              >
                Admin only
              </Button>
              {adminOpen && (
                <div className="grid grid-cols-2 gap-2">
                  {onActiveOnlyChange && (
                    <div className="col-span-2 flex items-center gap-2 px-1">
                      <Switch
                        size="sm"
                        isSelected={activeOnly}
                        onValueChange={onActiveOnlyChange}
                        aria-label="Toggle active members only"
                      >
                        Active Last 2 Years
                      </Switch>
                    </div>
                  )}
                  {onFindDuplicates && (
                    <Button
                      size="sm"
                      
                      variant="tertiary"
                      startContent={
                        <Icon icon="lucide:users" className="w-4 h-4" />
                      }
                      onPress={onFindDuplicates}
                      className="font-medium w-full"
                    >
                      Find Duplicates
                    </Button>
                  )}
                  <Button
                    size="sm"
                    
                    startContent={<PlusIcon className="w-4 h-4" />}
                    onPress={onAdd}
                    className="font-medium w-full"
                  >
                    Add Member
                  </Button>
                </div>
              )}
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
              <Tooltip>
                <Tooltip.Trigger>
                  <div>
                  <EmailMembersButton
                    members={members}
                    activeSet={activeSet}
                    currentYear={currentYear}
                    size="sm"
                  />
                </div>
                </Tooltip.Trigger>
                <Tooltip.Content>
                  Email active members
                </Tooltip.Content>
              </Tooltip>
              {onExportMembers && (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                    size="sm"
                    variant="tertiary"
                    startContent={
                      <Icon icon="lucide:download" className="w-4 h-4" />
                    }
                    onPress={onExportMembers}
                    isDisabled={members.length === 0}
                    className="font-medium"
                  >
                    Export
                  </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    Export member list to CSV
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
          )}
          {/* Admin only: horizontal sliding drawer */}
          {isAdmin && (
            <div className="flex items-center gap-2 pl-2 border-l border-divider">
              <Button
                size="sm"
                
                variant="tertiary"
                onPress={() => setAdminOpen((o) => !o)}
                aria-expanded={adminOpen}
                aria-label="Toggle admin actions"
                className="font-medium"
                endContent={
                  <Icon
                    icon="lucide:chevron-right"
                    className={`w-3 h-3 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                  />
                }
              >
                Admin only
              </Button>
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
                      
                      variant="tertiary"
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
