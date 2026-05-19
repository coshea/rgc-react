import { useEffect, useRef, useState } from "react";
import { Link, Button } from "@heroui/react";
import { Icon } from "@iconify/react";

type NavChild = {
  title: string;
  link: string;
  icon?: string;
  description?: string;
};

type Props = {
  label: string;
  items: NavChild[];
  isMobile?: boolean;
  onNavigate?: () => void; // called when a link is clicked to allow parent to close menus
};

export default function NavDropdown({
  label,
  items,
  isMobile,
  onNavigate,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    // Close this dropdown when another dropdown opens
    function onOtherOpen(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.label && detail.label !== label) setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener(
      "nav-dropdown-open",
      onOtherOpen as EventListener,
    );
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener(
        "nav-dropdown-open",
        onOtherOpen as EventListener,
      );
    };
  }, [open]);

  if (isMobile) {
    return (
      <div ref={containerRef}>
        <div className="mb-1 w-full px-2 text-xs font-semibold tracking-wide text-muted">
          {label}
        </div>
        <div className="mt-1">
          {items.map((child) => (
            <Link
              key={child.link}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-foreground hover:bg-default/60 no-underline"
              href={child.link}
              onClick={() => onNavigate?.()}
            >
              {child.icon ? (
                <Icon
                  icon={child.icon}
                  className="text-lg text-muted"
                />
              ) : null}
              <span className="flex-1">{child.title}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Desktop floating dropdown
  return (
    <div className="relative" ref={containerRef}>
      <Button
        className="p-0 bg-transparent text-muted inline-flex items-center gap-1"
        radius="sm"
        variant="ghost"
        aria-haspopup="true"
        aria-expanded={open}
        onPress={() => {
          setOpen((s) => {
            const next = !s;
            if (next) {
              // notify other dropdowns that this one opened
              document.dispatchEvent(
                new CustomEvent("nav-dropdown-open", { detail: { label } }),
              );
            }
            return next;
          });
        }}
      >
        {label}
        <Icon
          icon="lucide:chevron-down"
          className={`transform transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <div className="absolute left-0 mt-1 z-50 pointer-events-auto origin-top-left">
          <div className="w-[320px] bg-background rounded-xl shadow-lg p-2">
            {items.map((child) => (
              <Link
                key={child.link}
                href={child.link}
                className="flex items-start gap-3 p-3 rounded hover:bg-default/60 no-underline"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <div className="w-8 h-8 rounded-md bg-default/60 flex items-center justify-center text-accent">
                  {child.icon ? (
                    <Icon icon={child.icon} className="text-lg" />
                  ) : (
                    <Icon icon="lucide:chevron" className="text-lg" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {child.title}
                  </div>
                  {child.description && (
                    <div className="text-xs text-muted">
                      {child.description}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
