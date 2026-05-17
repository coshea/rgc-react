import { Dropdown } from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  useAdminFlag,
  useBoardMemberFlag,
} from "@/components/membership/hooks";
import { ThemeSwitch } from "./theme-switch";
import { NotificationBell } from "./notification-bell";
import { siteConfig } from "@/config/site";

export const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const { userProfile } = useUserProfile();
  const { isAdmin } = useAdminFlag(user);
  const { isBoardMember } = useBoardMemberFlag(user);

  return (
    <>
      <NotificationBell />
      <Dropdown placement="bottom-end">
        <Dropdown.Trigger>
          <div className="relative inline-block ml-3" aria-label="Profile menu">
            <UserAvatar
              as="button"
              isBordered
              color={isAdmin ? "accent" : "default"}
              className="transition-transform"
              size="sm"
              user={
                userProfile ??
                (user
                  ? {
                      id: user.uid,
                      displayName: user.displayName ?? undefined,
                      email: user.email ?? undefined,
                      photoURL: user.photoURL ?? undefined,
                    }
                  : undefined)
              }
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
        </Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Profile Actions">
            <Dropdown.Item
              id="profile-info"
              className="h-14 gap-2"
              isReadOnly
              textValue={`Signed in as ${user?.email ?? "user@example.com"}`}
            >
              <span className="block text-xs text-default-500">
                Signed in as
              </span>
              <span className="block truncate max-w-[200px] text-sm">
                {user?.email ?? "user@example.com"}
              </span>
            </Dropdown.Item>

            <Dropdown.Item
              id="settings"
              textValue="My Profile"
              onPress={() => {
                const href = user
                  ? `/profile/${user.uid}`
                  : siteConfig.pages.profile.link;
                window.location.href = href;
              }}
            >
              My Profile
            </Dropdown.Item>

            <Dropdown.Item
              id="theme"
              closeOnSelect={false}
              className="cursor-default"
              textValue="Theme"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-foreground">Theme</span>
                <ThemeSwitch />
              </div>
            </Dropdown.Item>

            {(isAdmin || isBoardMember) && (
              <Dropdown.Section title="Admin">
                <Dropdown.Item
                  id="admin-dashboard"
                  textValue="Admin Dashboard"
                  onPress={() => {
                    window.location.href = siteConfig.pages.adminDashboard.link;
                  }}
                  startContent={
                    <Icon
                      icon="lucide:layout-dashboard"
                      className="text-base text-default-500"
                    />
                  }
                >
                  Admin Dashboard
                </Dropdown.Item>
              </Dropdown.Section>
            )}

            <Dropdown.Item id="logout" onPress={logout}>
              Log Out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
};
