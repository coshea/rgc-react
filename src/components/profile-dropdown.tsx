import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Link,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDocAdminFlag } from "@/components/membership/hooks";
import { ThemeSwitch } from "./theme-switch";
import { NotificationBell } from "./notification-bell";
import { siteConfig } from "@/config/site";

export const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const { userProfile } = useUserProfile();
  const { isAdmin } = useDocAdminFlag(user);

  return (
    <>
      <NotificationBell />
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
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-linear-to-br from-purple-500 to-fuchsia-500 border-2 border-background shadow-sm flex items-center justify-center"
                aria-label="Admin user"
                title="Admin"
              >
                <span className="block w-1.5 h-1.5 rounded-full bg-white/90" />
              </span>
            )}
          </div>
        </DropdownTrigger>
        <DropdownMenu aria-label="Profile Actions" variant="flat">
          <DropdownItem
            key="profile"
            className="h-14 gap-2"
            isReadOnly
            textValue={`Signed in as ${user?.email ?? "user@example.com"}`}
          >
            <span className="block text-xs text-default-500">Signed in as</span>
            <span className="block truncate max-w-[200px] text-sm">
              {user?.email ?? "user@example.com"}
            </span>
          </DropdownItem>

          <DropdownItem
            key="settings"
            as={Link}
            href={user ? `/profile/${user.uid}` : siteConfig.pages.profile.link}
          >
            My Profile
          </DropdownItem>

          <DropdownItem
            key="theme"
            closeOnSelect={false}
            className="cursor-default"
            textValue="Theme"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-foreground">Theme</span>
              <ThemeSwitch />
            </div>
          </DropdownItem>

          {isAdmin ? (
            <DropdownSection
              title="Admin"
              showDivider
              classNames={{
                heading:
                  "text-tiny font-semibold uppercase text-default-400 px-1",
              }}
            >
              <DropdownItem
                key="admin-notifications"
                as={Link}
                href={siteConfig.pages.adminNotifications.link}
                startContent={
                  <Icon
                    icon="lucide:bell"
                    className="text-base text-default-500"
                  />
                }
              >
                Send Notifications
              </DropdownItem>
              <DropdownItem
                key="admin-membership"
                as={Link}
                href={siteConfig.pages.membershipDashboard.link}
                startContent={
                  <Icon
                    icon="lucide:users"
                    className="text-base text-default-500"
                  />
                }
              >
                Membership Dashboard
              </DropdownItem>
            </DropdownSection>
          ) : null}

          <DropdownItem key="logout" color="danger" onPress={logout}>
            Log Out
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </>
  );
};
