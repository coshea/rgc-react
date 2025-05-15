import {
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  Link,
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
import { ThemeSwitch } from "./theme-switch";

export const ProfileDropdown = () => {
  const { user, logout } = useAuth(); // Get user object and logout function

  return (
    <>
      <NavbarContent as="div" justify="end">
        <ThemeSwitch />
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Avatar
              isBordered
              as="button"
              className="transition-transform"
              color="secondary"
              name={user?.displayName || "User"}
              size="sm"
              src={user?.photoURL || undefined} // Use undefined if photoURL is null/empty to let Avatar handle fallback
              showFallback // Ensure fallback (initials or default icon) is shown if src is invalid/missing
            />
          </DropdownTrigger>
          <DropdownMenu aria-label="Profile Actions" variant="flat">
            <DropdownItem key="profile" className="h-14 gap-2">
              <p className="font-semibold">Signed in as</p>
              <p className="font-semibold">
                {user?.email || "user@example.com"}
              </p>
            </DropdownItem>
            <DropdownItem key="settings">My Settings</DropdownItem>
            <DropdownItem key="team_settings">Team Settings</DropdownItem>
            <DropdownItem key="logout" color="danger" onPress={logout}>
              Log Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>
    </>
  );
};
