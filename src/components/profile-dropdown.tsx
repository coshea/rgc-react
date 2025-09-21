import {
  NavbarContent,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Link,
} from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider"; // Import useAuth
import { useUserProfile } from "@/hooks/useUserProfile";
import { ThemeSwitch } from "./theme-switch";
import { siteConfig } from "@/config/site";

export const ProfileDropdown = () => {
  const { user, logout } = useAuth(); // Get user object and logout function
  const { userProfile } = useUserProfile();

  return (
    <>
      <NavbarContent as="div" justify="end">
        <ThemeSwitch />
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <UserAvatar
              as="button"
              isBordered
              color="secondary"
              className="transition-transform"
              name={userProfile?.displayName || user?.displayName || "User"}
              size="sm"
              src={
                (userProfile?.photoURL as string | undefined) ||
                (user?.photoURL as string | undefined)
              }
              alt={userProfile?.displayName || user?.displayName || "User"}
              role="button"
              tabIndex={0}
            />
          </DropdownTrigger>
          <DropdownMenu aria-label="Profile Actions" variant="flat">
            <DropdownItem key="profile" className="h-14 gap-2">
              {`Signed in as ${user?.email ?? "user@example.com"}`}
            </DropdownItem>

            <DropdownItem
              key="settings"
              as={Link}
              href={siteConfig.pages.profile.link}
            >
              My Profile
            </DropdownItem>

            {/* Admin-only menu: Manage Tournaments */}
            {userProfile?.admin === true ? (
              <DropdownItem
                key="manage_tournaments"
                as={Link}
                href="/tournaments"
              >
                Manage Tournaments
              </DropdownItem>
            ) : null}

            <DropdownItem key="logout" color="danger" onPress={logout}>
              Log Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>
    </>
  );
};
