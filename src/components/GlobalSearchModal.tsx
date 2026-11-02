import { useState, useEffect, useMemo } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import { Command } from "@heroui-pro/react/command";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
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
  // Route pattern (/wrapped/:year), not a linkable page.
  siteConfig.pages.seasonWrapped.link,
]);

// Derived at module load from siteConfig — pages with an icon that aren't
// admin/auth/settings routes. New siteConfig entries with an icon appear
// automatically without editing this file.
const SEARCHABLE_PAGES = Object.values(siteConfig.pages).filter(
  (p): p is typeof p & { icon: string } =>
    "icon" in p && !!p.icon && !EXCLUDED_SEARCH_PATHS.has(p.link),
);

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

  const hasQuery = searchQuery.trim().length > 0;

  function handleSelect(href: string) {
    navigate(href);
    onClose();
  }

  return (
    <Command>
      <Command.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <Command.Container>
          <Command.Dialog
            aria-label="Search"
            inputValue={searchQuery}
            onInputChange={setSearchQuery}
          >
            <Command.InputGroup aria-label="Search pages and tournaments">
              <Command.InputGroup.Prefix>
                <Icon icon="lucide:search" className="text-muted text-xl" />
              </Command.InputGroup.Prefix>
              <Command.InputGroup.Input placeholder="Search pages and tournaments…" />
              <Command.InputGroup.Suffix className="gap-2">
                {loading && hasQuery && (
                  <Spinner size="sm" aria-label="Loading tournaments" />
                )}
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-default/60 px-1.5 py-0.5 text-[11px] text-muted font-mono">
                  <span className="text-sm">⌘</span>K
                </kbd>
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  aria-label="Close search"
                  className="sm:hidden text-muted rounded-full h-11 w-11"
                  onPress={onClose}
                >
                  <Icon icon="lucide:x" className="text-lg" />
                </Button>
              </Command.InputGroup.Suffix>
            </Command.InputGroup>

            <Command.List
              aria-label="Search results"
              className="max-h-[60dvh]"
              onAction={(key) => handleSelect(String(key))}
              renderEmptyState={() => (
                <span>No results for &ldquo;{searchQuery}&rdquo;</span>
              )}
            >
              <Command.Group heading="Pages">
                {SEARCHABLE_PAGES.map((page) => (
                  <Command.Item
                    key={page.link}
                    id={page.link}
                    textValue={`${page.title} ${page.description}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-default/60">
                      <Icon icon={page.icon} className="text-muted text-base" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {page.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {page.description}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              {/* Tournaments only appear once the member starts typing. */}
              {hasQuery && tournamentResults.length > 0 && (
                <Command.Group heading="Tournaments">
                  {tournamentResults.map((t) => (
                    <Command.Item
                      key={t.firestoreId}
                      id={`/tournaments/${t.firestoreId}`}
                      textValue={t.title}
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
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>

            {!hasQuery && (
              <Command.Footer className="text-center text-xs text-muted">
                Type to search pages and tournaments
              </Command.Footer>
            )}
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}
