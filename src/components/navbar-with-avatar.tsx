import { useState, useRef, useEffect } from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Link,
  Button,
  Divider,
  NavbarProps,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import NavDropdown from "@/components/nav-dropdown";

import { cn } from "@heroui/react";
import { RGCLogo as RGCLogo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { ProfileDropdown } from "./profile-dropdown";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
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

export const MainNavbar = (_props: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { userLoggedIn, loading } = useAuth(); // Get auth state

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

  return (
    <Navbar
      isBordered
      {..._props}
      classNames={{
        base: cn("border-default-100", {
          "bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
        }),
        wrapper: "w-full justify-between",
        item: "hidden md:flex",
      }}
      height="60px"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      {/* Left Content */}
      <NavbarContent className="flex">
        {/* Mobile Content */}
        <NavbarMenuToggle className="text-default-400 md:hidden" />

        {/* Mobile Dropdown */}
        <NavbarMenu
          className="
          md:hidden
          top-[calc(var(--navbar-height)-1px)] 
max-h-fit bg-background pb-6 pt-4 shadow-large border-b border-default-200/60 
dark:border-default-100/10"
        >
          {Object.entries(menuItemsMobile).map(([label, items]: any, idx) => (
            <NavbarMenuItem key={`${label}-${idx}`}>
              {Array.isArray(items) && items.length > 1 ? (
                <NavDropdown
                  label={label}
                  items={items}
                  isMobile
                  onNavigate={() => setIsMenuOpen(false)}
                />
              ) : (
                <Link
                  className="mb-2 w-full rounded-lg px-2 py-2 text-foreground hover:bg-default-100"
                  href={Array.isArray(items) && items[0] ? items[0].link : "#"}
                  size="md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {Array.isArray(items) && items[0] ? items[0].title : label}
                </Link>
              )}

              {idx < Object.keys(menuItemsMobile).length - 1 && (
                <Divider className="opacity-50" />
              )}
            </NavbarMenuItem>
          ))}
        </NavbarMenu>

        <NavbarBrand>
          <Link
            href={siteConfig.pages.home.link}
            aria-label="Home"
            className="flex items-center gap-2"
          >
            <div>
              <RGCLogo />
            </div>
          </Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Center Content */}
      <NavbarContent className="hidden md:flex" justify="center">
        {Object.entries(menuItemsDesktop).map(([label, items]: any, idx) => (
          <NavbarMenuItem key={`${label}-${idx}`}>
            {Array.isArray(items) && items.length > 1 ? (
              <NavDropdown
                label={label}
                items={items}
                onNavigate={() => setOpenDropdown(null)}
              />
            ) : (
              <Link
                className="text-default-500 flex items-center gap-2"
                href={Array.isArray(items) && items[0] ? items[0].link : "#"}
                size="sm"
              >
                {Array.isArray(items) && items[0] && items[0].icon && (
                  <Icon icon={items[0].icon} className="text-base" />
                )}
                {Array.isArray(items) && items[0] ? items[0].title : label}
              </Link>
            )}
          </NavbarMenuItem>
        ))}
      </NavbarContent>

      {/* Right Content */}

      {/* Profile Dropdown */}
      <NavbarContent justify="end" className="pr-3 sm:pr-5">
        {loading ? (
          // Optional: Show a loading spinner or placeholder
          <div className="w-8 h-8" /> // Simple placeholder
        ) : userLoggedIn ? (
          <ProfileDropdown />
        ) : (
          <NavbarItem className="ml-2 flex gap-2">
            <Button
              className="text-default-500"
              radius="full"
              variant="light"
              as={Link}
              href={siteConfig.pages.login.link}
            >
              {siteConfig.pages.login.title}
            </Button>
            <Button
              className="bg-foreground font-medium text-background"
              color="secondary"
              endContent={<ChevronRightIcon />}
              radius="full"
              variant="flat"
              as={Link}
              href={siteConfig.pages.signup.link}
            >
              {siteConfig.pages.signup.title}
            </Button>
          </NavbarItem>
        )}
      </NavbarContent>
    </Navbar>
  );
};
