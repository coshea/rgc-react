import { useState } from "react";
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

import { cn } from "@heroui/react";
import { RGCLogo as RGCLogo } from "@/components/icons";
import { siteConfig } from "@/config/site";
import { ProfileDropdown } from "./profile-dropdown";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
import { ChevronRightIcon } from "@heroicons/react/24/solid";

const menuItemsDesktop = [
  siteConfig.pages.home,
  siteConfig.pages.tournaments,
  siteConfig.pages.membership,
  siteConfig.pages.policies,
  siteConfig.pages.contact,
];

const menuItemsMobile = [
  siteConfig.pages.home,
  siteConfig.pages.tournaments,
  siteConfig.pages.membership,
  siteConfig.pages.policies,
  siteConfig.pages.contact,
];

export const MainNavbarWithAvatar = (_props: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { userLoggedIn, loading } = useAuth(); // Get auth state

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
max-h-fit bg-default-200/50 pb-6 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 
dark:bg-default-100/50"
        >
          {menuItemsMobile.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                className="mb-2 w-full text-default-500"
                href={item.link}
                size="md"
              >
                {item.title}
              </Link>
              {index < menuItemsMobile.length - 1 && (
                <Divider className="opacity-50" />
              )}
            </NavbarMenuItem>
          ))}
        </NavbarMenu>

        <NavbarBrand>
          <Link href={siteConfig.pages.home.link} aria-label="Home">
            <div className="rounded-full bg-foreground text-background">
              <div>
                <RGCLogo />
              </div>
            </div>
          </Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Center Content */}
      <NavbarContent className="hidden md:flex" justify="center">
        {menuItemsDesktop.map((item, index) => (
          <NavbarMenuItem key={`${item}-${index}`}>
            <Link className="text-default-500" href={item.link} size="sm">
              {item.title}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarContent>

      {/* Right Content */}

      {/* Profile Dropdown */}
      <NavbarContent justify="end">
        {loading ? (
          // Optional: Show a loading spinner or placeholder
          <div className="w-8 h-8" /> // Simple placeholder
        ) : userLoggedIn ? (
          <ProfileDropdown />
        ) : (
          <NavbarItem className="ml-2 flex! gap-2">
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
