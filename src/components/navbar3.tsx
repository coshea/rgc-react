// not in use

import React from "react";

import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Link,
  Button,
  Avatar,
  NavbarProps,
} from "@heroui/react";
import { Icon } from "@iconify/react";

export const MainNavbar = (_props: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  return (
    <main className="min-h-screen">
      <Navbar
        isBordered
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        className="fixed top-0"
      >
        <NavbarContent className="sm:hidden" justify="start">
          <NavbarMenuToggle aria-label="Open menu" />
        </NavbarContent>

        <NavbarBrand>
          <Icon icon="lucide:layout-dashboard" className="text-2xl" />
          <p className="font-bold text-inherit ml-2">ACME</p>
        </NavbarBrand>

        <NavbarContent className="hidden sm:flex gap-4" justify="center">
          <NavbarItem>
            <Link color="foreground" href="#">
              Dashboard
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="#">
              Projects
            </Link>
          </NavbarItem>
          <NavbarItem>
            <Link color="foreground" href="#">
              Team
            </Link>
          </NavbarItem>
        </NavbarContent>

        <NavbarContent justify="end">
          {isLoggedIn ? (
            <NavbarItem>
              <Avatar
                name="User"
                size="sm"
                src="https://img.heroui.chat/image/avatar?w=150&h=150&u=4"
                className="cursor-pointer"
              />
            </NavbarItem>
          ) : (
            <NavbarItem>
              <Button
                color="primary"
                variant="flat"
                onPress={() => setIsLoggedIn(true)} // Demo login
              >
                Login
              </Button>
            </NavbarItem>
          )}
        </NavbarContent>

        <NavbarMenu>
          <NavbarMenuItem>
            <Link color="foreground" href="#" size="lg">
              Dashboard
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link color="foreground" href="#" size="lg">
              Projects
            </Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link color="foreground" href="#" size="lg">
              Team
            </Link>
          </NavbarMenuItem>
        </NavbarMenu>
      </Navbar>
    </main>
  );
};
