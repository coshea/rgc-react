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

import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { cn } from "@heroui/react";
import { RGCLogo as RGCLogo } from "@/components/icons";
import { ThemeSwitch } from "@/components/theme-switch";
import { siteConfig } from "@/config/site";
import { ProfileDropdown } from "./profile-dropdown";

const menuItemsDesktop = [
  siteConfig.pages.home,
  siteConfig.pages.membership,
  siteConfig.pages.policies,
  siteConfig.pages.contact,
];

const menuItemsMobile = [
  siteConfig.pages.home,
  siteConfig.pages.membership,
  siteConfig.pages.policies,
  siteConfig.pages.contact,
];

export const MainNavbar = (_props: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Navbar
      isBordered
      {..._props}
      classNames={{
        base: cn("border-default-100", {
          "bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
        }),
        wrapper: "w-full justify-center",
        item: "hidden md:flex",
      }}
      height="60px"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
    >
      {/* Left Content */}
      <NavbarBrand className="flex  mb-2">
        <Link href={siteConfig.pages.home.link} aria-label="Home">
          <div className="rounded-full bg-foreground text-background">
            {/* Show RGCIcon on small screens (mobile) */}
            {/* <div className="md:hidden">
            <RGCIcon size={34} />
          </div> */}
            {/* Show RGCLogo on medium and larger screens */}
            {/* <div className="hidden md:block"> */}
            <div>
              <RGCLogo />
            </div>
          </div>
        </Link>
      </NavbarBrand>

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
      <NavbarContent className="hidden md:flex" justify="end">
        <NavbarItem className="hidden sm:flex gap-1"></NavbarItem>
        <NavbarItem className="ml-2 !flex gap-2">
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
        <ThemeSwitch />
      </NavbarContent>

      {/* Profile Dropdown */}
      <NavbarContent className="flex" justify="end">
        <ProfileDropdown />
      </NavbarContent>

      {/* Mobile Content */}
      <NavbarMenuToggle className="text-default-400 md:hidden" />

      <NavbarMenu
        className="top-[calc(var(--navbar-height)_-_1px)] 
      max-h-fit bg-default-200/50 pb-6 pt-6 shadow-medium backdrop-blur-md backdrop-saturate-150 
      dark:bg-default-100/50"
      >
        <ThemeSwitch className="flex" />
        <NavbarMenuItem>
          <Button
            fullWidth
            as={Link}
            href={siteConfig.pages.login.link}
            variant="faded"
          >
            {siteConfig.pages.login.title}
          </Button>
        </NavbarMenuItem>
        <NavbarMenuItem className="mb-4">
          <Button
            fullWidth
            as={Link}
            className="bg-foreground text-background"
            href={siteConfig.pages.signup.link}
          >
            {siteConfig.pages.signup.title}
          </Button>
        </NavbarMenuItem>
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
    </Navbar>
  );
};
