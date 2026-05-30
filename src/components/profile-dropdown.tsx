import { Button, Dropdown, Header, Separator } from "@heroui/react";
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
      <Dropdown>
        <Button
          isIconOnly
          variant="ghost"
          className="relative ml-3"
          aria-label="Profile menu"
        >
          <UserAvatar
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
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Profile Actions">
            <Dropdown.Item
              id="profile-info"
              className="gap-3 py-3"
              textValue={`Signed in as ${user?.email ?? "user@example.com"}`}
            >
              <div className="flex items-center gap-3">
                <UserAvatar
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
                />
                <div className="flex flex-col min-w-0">
                  {(userProfile?.displayName || user?.displayName) && (
                    <span className="block text-sm font-medium truncate max-w-[180px]">
                      {userProfile?.displayName ?? user?.displayName}
                    </span>
                  )}
                  <span className="block truncate max-w-[180px] text-xs text-muted">
                    {user?.email ?? "user@example.com"}
                  </span>
                </div>
              </div>
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
              <span className="flex items-center gap-2">
                <Icon icon="lucide:user" className="text-base text-muted" />
                <span>My Profile</span>
              </span>
            </Dropdown.Item>

            <Dropdown.Item
              id="theme"
              className="cursor-default"
              textValue="Theme"
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <Icon
                    icon="lucide:sun-moon"
                    className="text-base text-muted"
                  />
                  <span>Theme</span>
                </span>
                <ThemeSwitch />
              </div>
            </Dropdown.Item>

            {(isAdmin || isBoardMember) && (
              <>
                <Separator />
                <Dropdown.Section>
                  <Header>Admin</Header>
                  <Dropdown.Item
                    id="admin-dashboard"
                    textValue="Admin Dashboard"
                    onPress={() => {
                      window.location.href =
                        siteConfig.pages.adminDashboard.link;
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Icon
                        icon="lucide:layout-dashboard"
                        className="text-base text-muted"
                      />
                      <span>Admin Dashboard</span>
                    </span>
                  </Dropdown.Item>
                </Dropdown.Section>
              </>
            )}

            <Separator />
            <Dropdown.Section>
              <Dropdown.Item
                id="logout"
                className="text-danger"
                onPress={logout}
              >
                <span className="flex items-center gap-2">
                  <Icon icon="lucide:log-out" className="text-base" />
                  <span>Log Out</span>
                </span>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
};
