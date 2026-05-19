import { useState, useEffect, useMemo, useRef } from "react";
import { Modal, Input, Button, Chip, Separator, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { siteConfig } from "@/config/site";
import { useYearlyTournaments } from "@/hooks/useYearlyTournaments";
import { TournamentStatus } from "@/types/tournament";

// Paths excluded from search (admin-only, auth flow, or settings pages)
const EXCLUDED_SEARCH_PATHS = new Set([
  siteConfig.pages.login.link,
  siteConfig.pages.signup.link,
  siteConfig.pages.profile.link,
  siteConfig.pages.verifyEmail.link,
  siteConfig.pages.adminDashboard.link,
  siteConfig.pages.membershipDashboard.link,
  siteConfig.pages.adminNotifications.link,
  siteConfig.pages.notificationSettings.link,
]);

// Derived at module load from siteConfig — pages with an icon that aren't
// admin/auth/settings routes. New siteConfig entries with an icon appear
// automatically without editing this file.
const SEARCHABLE_PAGES = Object.values(siteConfig.pages).filter(
  (p): p is typeof p & { icon: string } =>
    "icon" in p && !!p.icon && !EXCLUDED_SEARCH_PATHS.has(p.link),
);

type PageResult = {
  type: "page";
  title: string;
  description: string;
  link: string;
  icon: string;
};

type TournamentResult = {
  type: "tournament";
  firestoreId: string;
  title: string;
  date: Date;
  status: TournamentStatus;
};

const STATUS_COLOR: Record<
  TournamentStatus,
  "success" | "warning" | "default" | "danger"
> = {
  [TournamentStatus.Upcoming]: "success",
  [TournamentStatus.InProgress]: "warning",
  [TournamentStatus.Completed]: "default",
  [TournamentStatus.Canceled]: "danger",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const currentYear = new Date().getFullYear();

  const { tournaments, isLoading: loading } = useYearlyTournaments({
    year: currentYear,
    enabled: isOpen,
  });

  const tournamentResults: TournamentResult[] = useMemo(
    () =>
      (tournaments ?? [])
        .map((t) => ({
          type: "tournament" as const,
          firestoreId: t.firestoreId!,
          title: t.title,
          date: t.date,
          status: t.status!,
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime()),
    [tournaments],
  );

  // Reset query when closed
  useEffect(() => {
    if (!isOpen) setSearchQuery("");
  }, [isOpen]);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredPages = useMemo<PageResult[]>(() => {
    const pages: PageResult[] = SEARCHABLE_PAGES.map((p) => ({
      ...p,
      type: "page",
    }));
    if (!trimmedQuery) return pages;
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(trimmedQuery) ||
        p.description.toLowerCase().includes(trimmedQuery),
    );
  }, [trimmedQuery]);

  const filteredTournaments = useMemo<TournamentResult[]>(() => {
    if (!trimmedQuery) return [];
    return tournamentResults.filter((t) =>
      t.title.toLowerCase().includes(trimmedQuery),
    );
  }, [trimmedQuery, tournamentResults]);

  function handleSelect(href: string) {
    navigate(href);
    onClose();
  }

  const showPages = filteredPages.length > 0;
  const showTournaments = filteredTournaments.length > 0;
  const noResults =
    trimmedQuery.length > 0 && !showPages && !showTournaments && !loading;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container
        size={isMobile ? "full" : "lg"}
        placement={isMobile ? "top" : "auto"}
      >
        <Modal.Dialog>
          <Modal.Body className="flex flex-col">
            {/* Search input */}
            <div className="flex items-center px-4 py-3 gap-3">
              <Icon
                icon="lucide:search"
                className="text-muted shrink-0 text-xl"
              />
              <Input
                ref={inputRef}
                autoFocus
                variant="tertiary"
                classNames={{
                  base: "flex-1",
                  inputWrapper:
                    "bg-transparent shadow-none border-none px-0 hover:bg-transparent data-[hover=true]:bg-transparent group-data-[focus=true]:bg-transparent",
                  input: "text-base placeholder:text-muted",
                }}
                placeholder="Search pages and tournaments…"
                value={searchQuery}
                onValueChange={setSearchQuery}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    onClose();
                  }
                }}
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-default/60 px-1.5 py-0.5 text-[11px] text-muted font-mono shrink-0">
                <span className="text-sm">⌘</span>K
              </kbd>
              <Button
                isIconOnly
                variant="ghost"
                radius="full"
                size="sm"
                aria-label="Close search"
                className="sm:hidden text-muted shrink-0"
                onPress={onClose}
              >
                <Icon icon="lucide:x" className="text-lg" />
              </Button>
            </div>

            <Separator />

            {/* Results */}
            <div className="overflow-y-auto pb-2 max-h-[60dvh] sm:max-h-[60vh]">
              {loading && (
                <div className="flex justify-center py-8">
                  <Spinner size="sm" />
                </div>
              )}

              {!loading && noResults && (
                <p className="py-8 text-center text-sm text-muted">
                  No results for &ldquo;{searchQuery}&rdquo;
                </p>
              )}

              {/* Pages section */}
              {!loading && showPages && (
                <section>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    Pages
                  </p>
                  {filteredPages.map((page) => (
                    <button
                      key={page.link}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-default/60 transition-colors cursor-pointer"
                      onClick={() => handleSelect(page.link)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default/60">
                        <Icon
                          icon={page.icon ?? "lucide:file"}
                          className="text-muted text-base"
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {page.title}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {page.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {/* Divider between sections */}
              {!loading && showPages && showTournaments && (
                <Separator className="my-1" />
              )}

              {/* Tournaments section */}
              {!loading && showTournaments && (
                <section>
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    Tournaments
                  </p>
                  {filteredTournaments.map((t) => (
                    <button
                      key={t.firestoreId}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-default/60 transition-colors cursor-pointer"
                      onClick={() =>
                        handleSelect(`/tournaments/${t.firestoreId}`)
                      }
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default/60">
                        <Icon
                          icon="lucide:calendar"
                          className="text-muted text-base"
                        />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {t.title}
                        </span>
                        <span className="block text-xs text-muted">
                          {formatDate(t.date)}
                        </span>
                      </span>
                      <Chip
                        size="sm"
                        variant="tertiary"
                        color={STATUS_COLOR[t.status]}
                        className="shrink-0"
                      >
                        {t.status}
                      </Chip>
                    </button>
                  ))}
                </section>
              )}

              {/* Default state: hint when no query entered */}
              {!loading && !trimmedQuery && !noResults && (
                <p className="py-5 text-center text-xs text-muted">
                  Type to search pages and tournaments
                </p>
              )}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}
