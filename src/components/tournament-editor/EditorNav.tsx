import React from "react";
import { Link } from "@heroui/react";
import clsx from "clsx";

export interface EditorNavItem {
  id: string;
  label: string;
  /** Heading shown above this item in the sidebar (starts a new group). */
  group?: string;
  badge?: string | number;
  hasError?: boolean;
}

export const sectionDomId = (id: string) => `editor-section-${id}`;

// Offset (px) below the viewport top at which a section counts as "current".
// Covers the sticky navbar (46px) plus the mobile chip bar.
const ACTIVE_LINE_PX = 140;

/**
 * Tracks which editor section is currently at the top of the viewport.
 * Uses a passive window scroll listener so it also works in jsdom.
 */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = React.useState<string | undefined>(ids[0]);
  const key = ids.join("|");

  React.useEffect(() => {
    const sectionIds = key ? key.split("|") : [];
    if (sectionIds.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActive(sectionIds[sectionIds.length - 1]);
        return;
      }
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(sectionDomId(id));
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE_PX) {
          current = id;
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [key]);

  return active;
}

export function scrollToSection(id: string) {
  document
    .getElementById(sectionDomId(id))
    ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

const ItemBadge: React.FC<{ item: EditorNavItem; active: boolean }> = ({
  item,
  active,
}) => {
  if (item.hasError) {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full bg-danger"
        aria-label="Has errors"
        role="img"
      />
    );
  }
  if (item.badge === undefined) return null;
  return (
    <span
      className={clsx(
        "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
        active ? "bg-accent-foreground text-accent" : "bg-default text-muted",
      )}
    >
      {item.badge}
    </span>
  );
};

interface EditorNavProps {
  items: EditorNavItem[];
  active: string | undefined;
  className?: string;
}

/** Desktop: sticky vertical list of section links. */
export const EditorSidebar: React.FC<EditorNavProps> = ({
  items,
  active,
  className,
}) => (
  <nav aria-label="Editor sections" className={className}>
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <li key={item.id}>
            {item.group && (
              <p className="px-3 pb-1 pt-4 text-[11px] uppercase tracking-wider text-muted first:pt-0">
                {item.group}
              </p>
            )}
            <Link
              href={`#${sectionDomId(item.id)}`}
              aria-current={isActive ? "location" : undefined}
              className={clsx(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm no-underline",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-foreground hover:bg-default",
              )}
            >
              <span>{item.label}</span>
              <ItemBadge item={item} active={false} />
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);

/** Phone: sticky, horizontally scrolling row of section chips. */
export const EditorChipBar: React.FC<EditorNavProps> = ({
  items,
  active,
  className,
}) => {
  const listRef = React.useRef<HTMLUListElement>(null);

  // Keep the active chip in view as the page scrolls.
  React.useEffect(() => {
    const list = listRef.current;
    if (!list || !active) return;
    const chip = list.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!chip || typeof list.scrollTo !== "function") return;
    list.scrollTo({ left: chip.offsetLeft - 12, behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label="Editor sections" className={className}>
      <ul
        ref={listRef}
        className="flex gap-2 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="shrink-0" data-section={item.id}>
              <Link
                href={`#${sectionDomId(item.id)}`}
                aria-current={isActive ? "location" : undefined}
                className={clsx(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm no-underline",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "bg-default text-foreground",
                )}
              >
                {item.label}
                <ItemBadge item={item} active={isActive} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

interface EditorSectionCardProps {
  id: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Live tools save immediately instead of through the page's Save button. */
  live?: boolean;
  children: React.ReactNode;
}

export const EditorSectionCard: React.FC<EditorSectionCardProps> = ({
  id,
  title,
  description,
  actions,
  live,
  children,
}) => {
  const headingId = `${sectionDomId(id)}-heading`;
  return (
    <section
      id={sectionDomId(id)}
      aria-labelledby={headingId}
      className="scroll-mt-28 md:scroll-mt-16 rounded-2xl border border-border bg-surface p-4 sm:p-5 min-w-0"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-medium">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {live && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-default px-3 py-2 text-xs text-muted">
          <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
          Changes here save as soon as you make them.
        </p>
      )}
      {children}
    </section>
  );
};
