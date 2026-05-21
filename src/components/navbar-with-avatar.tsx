import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import NavDropdown from "@/components/nav-dropdown";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";

import { RGCLogo as RGCLogo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { ProfileDropdown } from "./profile-dropdown";
import { useAuth } from "@/providers/AuthProvider";
import { ChevronRightIcon } from "@heroicons/react/24/solid";

const menuItemsMobile = {
  Home: [siteConfig.pages.home],
  Tournaments: [
    siteConfig.pages.tournaments,
    siteConfig.pages.moneyList,
    siteConfig.pages.pastchampions,
  ],
  Membership: [
    siteConfig.pages.membership,
    siteConfig.pages.directory,
    siteConfig.pages.findGame,
    siteConfig.pages.board,
  ],
  "Policies/Rules": [siteConfig.pages.policies],
  "Contact Us": [siteConfig.pages.contact],
};

const menuItemsDesktop = {
  Home: [siteConfig.pages.home],
  Tournaments: [
    siteConfig.pages.tournaments,
    siteConfig.pages.moneyList,
    siteConfig.pages.pastchampions,
  ],
  Membership: [
    siteConfig.pages.membership,
    siteConfig.pages.directory,
    siteConfig.pages.findGame,
    siteConfig.pages.board,
  ],
  "Policies/Rules": [siteConfig.pages.policies],
  "Contact Us": [siteConfig.pages.contact],
};

export const MainNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { userLoggedIn, loading } = useAuth();

  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!openDropdown) return;
      const node = containerRefs.current[openDropdown];
      if (node && !node.contains(e.target as Node)) setOpenDropdown(null);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenDropdown(null);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openDropdown]);

  useEffect(() => {
    function onSearchKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "k") return;
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      )
        return;
      e.preventDefault();
      setIsSearchOpen(true);
    }
    document.addEventListener("keydown", onSearchKey);
    return () => document.removeEventListener("keydown", onSearchKey);
  }, []);

  return (
    <>
      <nav className="z-40 w-full border-b bg-background/70 backdrop-blur-lg sticky top-0">
        <div
          className={`flex h-[45px] max-w-7xl mx-auto w-full items-center justify-between px-3 sm:px-4 transition-colors ${isMenuOpen ? "bg-default/60/50 dark:bg-default/60/50" : ""}`}
        >
          {/* Left: mobile toggle + logo */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              className="text-muted md:hidden p-1"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              <Icon
                icon={isMenuOpen ? "lucide:x" : "lucide:menu"}
                className="text-xl"
              />
            </button>

            {/* Logo */}
            <a
              href={siteConfig.pages.home.link}
              aria-label="Home"
              className="flex items-center gap-2"
            >
              <RGCLogo className="h-9 w-auto" />
            </a>
          </div>

          {/* Center: desktop nav */}
          <ul className="hidden md:flex items-center gap-4">
            {Object.entries(menuItemsDesktop).map(([label, items], idx) => (
              <li key={`${label}-${idx}`}>
                {Array.isArray(items) && items.length > 1 ? (
                  <NavDropdown
                    label={label}
                    items={items}
                    onNavigate={() => setOpenDropdown(null)}
                  />
                ) : (
                  <a
                    className="text-muted flex items-center gap-1 px-3 py-0.5 text-sm hover:text-foreground transition-colors rounded"
                    href={
                      Array.isArray(items) && items[0] ? items[0].link : "#"
                    }
                  >
                    {Array.isArray(items) && items[0] && items[0].icon && (
                      <Icon icon={items[0].icon} className="text-base" />
                    )}
                    {Array.isArray(items) && items[0] ? items[0].title : label}
                  </a>
                )}
              </li>
            ))}
          </ul>

          {/* Right: search + auth */}
          <div className="flex items-center gap-1 pr-2">
            <Button
              isIconOnly
              variant="ghost"
              radius="full"
              size="sm"
              aria-label="Search"
              className="text-muted"
              onPress={() => setIsSearchOpen(true)}
            >
              <Icon icon="lucide:search" className="text-lg" />
            </Button>

            {loading ? (
              <div className="w-8 h-8" />
            ) : userLoggedIn ? (
              <ProfileDropdown />
            ) : (
              <div className="ml-2 flex gap-2">
                <Button
                  className="text-muted"
                  radius="full"
                  variant="ghost"
                  onPress={() => navigate(siteConfig.pages.login.link)}
                >
                  {siteConfig.pages.login.title}
                </Button>
                <Button
                  className="bg-foreground font-medium text-background"
                  radius="full"
                  variant="tertiary"
                  onPress={() => navigate(siteConfig.pages.signup.link)}
                >
                  {siteConfig.pages.signup.title}
                  <ChevronRightIcon />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-background pb-6 pt-4 shadow-lg border-b/60 dark:/10">
            {/* Search row */}
            <div className="px-4 mb-2">
              <button
                className="w-full rounded-lg px-2 py-2 text-foreground hover:bg-default/60 flex items-center gap-2"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSearchOpen(true);
                }}
              >
                <Icon icon="lucide:search" className="text-base text-muted" />
                <span>Search</span>
              </button>
              <hr className="/50 mt-2" />
            </div>

            <ul className="px-4">
              {Object.entries(menuItemsMobile).map(([label, items], idx) => (
                <li key={`${label}-${idx}`}>
                  {Array.isArray(items) && items.length > 1 ? (
                    <NavDropdown
                      label={label}
                      items={items}
                      isMobile
                      onNavigate={() => setIsMenuOpen(false)}
                    />
                  ) : (
                    <a
                      className="mb-2 w-full rounded-lg px-2 py-2 text-foreground hover:bg-default/60 flex"
                      href={
                        Array.isArray(items) && items[0] ? items[0].link : "#"
                      }
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {Array.isArray(items) && items[0]
                        ? items[0].title
                        : label}
                    </a>
                  )}

                  {idx < Object.keys(menuItemsMobile).length - 1 && (
                    <hr className="/50 my-1" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
};
