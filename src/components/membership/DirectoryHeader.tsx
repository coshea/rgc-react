import { Button, Dropdown, Header, Separator, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";

import type { User } from "@/api/users";
import {
  EmailMembersButton,
  emailMembers,
  emailScopeOptions,
} from "./EmailMembersButton";

interface DirectoryHeaderProps {
  /** Admin tools are shown (an admin with admin view on). */
  isAdmin: boolean;
  isAdminOrBoard: boolean;
  /** e.g. "287 members" or "241 active of 287". */
  summary: string;
  onAdd: () => void;
  onFindDuplicates: () => void;
  onExportMembers: () => void;
  members: User[];
  activeSet: Set<string>;
  currentYear: number;
  /** Admins only: lets them switch to what members see. */
  adminViewToggle?: { isSelected: boolean; onChange: (on: boolean) => void };
}

function AdminViewSwitch({
  isSelected,
  onChange,
}: NonNullable<DirectoryHeaderProps["adminViewToggle"]>) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} className="shrink-0">
      {/* Switch.Content renders the real input; the control must sit inside it. */}
      <Switch.Content className="min-h-11 gap-2 text-sm">
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Admin view
      </Switch.Content>
    </Switch>
  );
}

/**
 * Title plus member tools. Desktop shows the tools as buttons; phones put them
 * in one ⋯ menu so the list starts near the top of the screen.
 */
export function DirectoryHeader({
  isAdmin,
  isAdminOrBoard,
  summary,
  onAdd,
  onFindDuplicates,
  onExportMembers,
  members,
  activeSet,
  currentYear,
  adminViewToggle,
}: DirectoryHeaderProps) {
  const noMembers = members.length === 0;

  return (
    <div className="flex items-start justify-between gap-3 lg:items-center">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3">
        <h1 className="text-[28px] leading-tight lg:text-[32px]">Members</h1>
        <p className="text-sm text-muted lg:text-[15px]">{summary}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {adminViewToggle && <AdminViewSwitch {...adminViewToggle} />}
        {isAdminOrBoard && (
          <>
            <div className="hidden flex-wrap items-center justify-end gap-2 lg:flex">
              <EmailMembersButton
                members={members}
                activeSet={activeSet}
                currentYear={currentYear}
                variant="tertiary"
              />
              <Button
                variant="tertiary"
                onPress={onExportMembers}
                isDisabled={noMembers}
              >
                <Icon icon="lucide:download" className="h-4 w-4" />
                Export CSV
              </Button>
              {isAdmin && (
                <>
                  <Button variant="tertiary" onPress={onFindDuplicates}>
                    <Icon icon="lucide:users" className="h-4 w-4" />
                    Find duplicates
                  </Button>
                  <Button onPress={onAdd}>
                    <Icon icon="lucide:plus" className="h-4 w-4" />
                    Add member
                  </Button>
                </>
              )}
            </div>

            <div className="lg:hidden">
              <Dropdown>
                <Button
                  isIconOnly
                  variant="tertiary"
                  className="h-11 w-11 rounded-full"
                  aria-label="Member tools"
                >
                  <Icon icon="lucide:ellipsis" className="h-5 w-5" />
                </Button>
                <Dropdown.Popover placement="bottom end">
                  <Dropdown.Menu aria-label="Member tools">
                    <Dropdown.Section>
                      <Header>Email members</Header>
                      {emailScopeOptions(currentYear).map((o) => (
                        <Dropdown.Item
                          key={o.id}
                          id={`email-${o.id}`}
                          textValue={o.label}
                          onPress={() =>
                            void emailMembers(
                              members,
                              activeSet,
                              o.id,
                              currentYear,
                            )
                          }
                        >
                          {o.label}
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Section>
                    <Separator />
                    <Dropdown.Section>
                      <Dropdown.Item
                        id="export"
                        textValue="Export CSV"
                        isDisabled={noMembers}
                        onPress={onExportMembers}
                      >
                        <span className="flex items-center gap-2">
                          <Icon
                            icon="lucide:download"
                            className="h-4 w-4 text-muted"
                          />
                          Export CSV
                        </span>
                      </Dropdown.Item>
                      {isAdmin && (
                        <Dropdown.Item
                          id="duplicates"
                          textValue="Find duplicates"
                          onPress={onFindDuplicates}
                        >
                          <span className="flex items-center gap-2">
                            <Icon
                              icon="lucide:users"
                              className="h-4 w-4 text-muted"
                            />
                            Find duplicates
                          </span>
                        </Dropdown.Item>
                      )}
                      {isAdmin && (
                        <Dropdown.Item
                          id="add"
                          textValue="Add member"
                          onPress={onAdd}
                        >
                          <span className="flex items-center gap-2">
                            <Icon
                              icon="lucide:plus"
                              className="h-4 w-4 text-muted"
                            />
                            Add member
                          </span>
                        </Dropdown.Item>
                      )}
                    </Dropdown.Section>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
