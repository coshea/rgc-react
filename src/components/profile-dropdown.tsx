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
import { useDocAdminFlag } from "@/components/membership/hooks";
import { ThemeSwitch } from "./theme-switch";
import { siteConfig } from "@/config/site";

export const ProfileDropdown = () => {
  const { user, logout } = useAuth(); // Get user object and logout function
  const { userProfile } = useUserProfile();
  const { isAdmin } = useDocAdminFlag(user);

  return (
    <>
      <NavbarContent as="div" justify="end">
        <ThemeSwitch />
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <div className="relative inline-block" aria-label="Profile menu">
              <UserAvatar
                as="button"
                isBordered
                color={isAdmin ? "secondary" : "default"}
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
              {isAdmin && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 border-2 border-background shadow-sm flex items-center justify-center"
                  aria-label="Admin user"
                  title="Admin"
                >
                  <span className="block w-[6px] h-[6px] rounded-full bg-white/90" />
                </span>
              )}
            </div>
          </DropdownTrigger>
          <DropdownMenu aria-label="Profile Actions" variant="flat">
            <DropdownItem key="profile" className="h-14 gap-2">
              {`Signed in as ${user?.email ?? "user@example.com"}`}
            </DropdownItem>

            <DropdownItem
              key="settings"
              as={Link}
              href={
                user ? `/profile/${user.uid}` : siteConfig.pages.profile.link
              }
            >
              My Profile
            </DropdownItem>

            {/* Admin-only menu: Manage Tournaments */}
            {isAdmin ? (
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
