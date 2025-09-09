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

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isMobile) {
    return (
      <div ref={containerRef}>
        <div className="mb-2 w-full text-default-500 font-medium">{label}</div>
        <div className="pl-2">
          {items.map((child) => (
            <Link
              key={child.link}
              className="block mb-2 text-default-500"
              href={child.link}
              onClick={() => onNavigate?.()}
            >
              {child.title}
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
        disableRipple
        className="p-0 bg-transparent text-default-500 inline-flex items-center gap-1"
        endContent={
          <Icon
            icon="lucide:chevron-down"
            className={`transform transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        }
        radius="sm"
        variant="light"
        aria-haspopup="true"
        aria-expanded={open}
        onPress={() => setOpen((s) => !s)}
      >
        {label}
      </Button>

      {open && (
        <div className="absolute left-0 mt-1 z-50 pointer-events-auto origin-top-left">
          <div className="w-[320px] bg-background rounded-xl shadow-lg p-2">
            {items.map((child) => (
              <Link
                key={child.link}
                href={child.link}
                className="flex items-start gap-3 p-3 rounded hover:bg-default-100"
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              >
                <div className="w-8 h-8 rounded-md bg-default-50 flex items-center justify-center text-primary">
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
                    <div className="text-xs text-foreground-500">
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
