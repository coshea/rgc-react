import type { Selection } from "@heroui/react";

import { Button, Dropdown, Header, Label, Separator } from "@heroui/react";
import { Icon } from "@iconify/react";

export interface AdminSection<K extends string = string> {
  key: K;
  label: string;
  icon: string;
  group: string;
}

interface AdminSectionNavProps<K extends string> {
  sections: readonly AdminSection<K>[];
  activeKey: K;
  onSelect: (key: K) => void;
}

/** Groups sections by `group`, keeping the order groups first appear in. */
function groupSections<K extends string>(sections: readonly AdminSection<K>[]) {
  const groups = new Map<string, AdminSection<K>[]>();

  for (const section of sections) {
    const list = groups.get(section.group) ?? [];

    list.push(section);
    groups.set(section.group, list);
  }

  return [...groups.entries()];
}

/**
 * Admin dashboard navigation. Desktop gets a sticky grouped sidebar; phones
 * and tablets get a sticky full-width section picker. Both read the same
 * `sections` list, so adding a section is one entry in the page config.
 */
export function AdminSectionNav<K extends string>({
  sections,
  activeKey,
  onSelect,
}: AdminSectionNavProps<K>) {
  const groups = groupSections(sections);
  const active = sections.find((s) => s.key === activeKey) ?? sections[0];

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") return;
    const [next] = keys;

    if (next !== undefined) onSelect(String(next) as K);
  };

  return (
    <>
      {/* Phone + tablet: sticky section picker below the site navbar */}
      <div className="sticky top-[46px] z-30 -mx-4 mb-4 border-b border-separator bg-background/85 px-4 py-2 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:hidden">
        <Dropdown>
          <Button
            aria-label={`Admin section: ${active.label}. Change section`}
            className="h-12 w-full justify-between"
            variant="secondary"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Icon icon={active.icon} className="size-5 shrink-0" />
              <span className="truncate font-semibold">{active.label}</span>
              <span className="truncate text-sm font-normal text-muted">
                {active.group}
              </span>
            </span>
            <Icon icon="lucide:chevrons-up-down" className="size-4 shrink-0" />
          </Button>
          <Dropdown.Popover
            className="w-[var(--trigger-width)] max-h-[70vh]"
            placement="bottom"
          >
            <Dropdown.Menu
              aria-label="Admin sections"
              selectedKeys={new Set([active.key])}
              selectionMode="single"
              onSelectionChange={handleSelectionChange}
            >
              {groups.map(([group, items], i) => (
                <Dropdown.Section key={group}>
                  {i > 0 && <Separator />}
                  <Header>{group}</Header>
                  {items.map((item) => (
                    <Dropdown.Item
                      key={item.key}
                      className="min-h-11"
                      id={item.key}
                      textValue={item.label}
                    >
                      <Icon
                        icon={item.icon}
                        className="size-4 shrink-0 text-muted"
                      />
                      <Label>{item.label}</Label>
                      <Dropdown.ItemIndicator className="ms-auto" />
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      {/* Desktop: grouped sidebar */}
      <nav
        aria-label="Admin sections"
        className="sticky top-[70px] hidden max-h-[calc(100vh-94px)] w-56 shrink-0 overflow-y-auto lg:block"
      >
        {groups.map(([group, items]) => (
          <div key={group} className="mb-5 last:mb-0">
            <h2 className="mb-1 px-3 text-xs font-medium text-muted">
              {group}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const isActive = item.key === active.key;

                return (
                  <li key={item.key}>
                    <Button
                      aria-current={isActive ? "page" : undefined}
                      className={`h-10 w-full justify-start gap-3 px-3 font-normal ${
                        isActive
                          ? "bg-surface font-semibold text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                      variant="ghost"
                      onPress={() => onSelect(item.key)}
                    >
                      <Icon
                        icon={item.icon}
                        className={`size-4 shrink-0 ${isActive ? "text-accent" : ""}`}
                      />
                      {item.label}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
