import {
  NavbarContent,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Link,
} from "@heroui/react";
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
            <Avatar
              isBordered
              as="button"
              className="transition-transform"
              color="secondary"
              name={userProfile?.displayName || user?.displayName || "User"}
              size="sm"
              src={
                (userProfile?.photoURL as string | undefined) ||
                (user?.photoURL as string | undefined)
              } // prefer profile.photoURL, then auth.photoURL
              showFallback // Ensure fallback (initials or default icon) is shown if src is invalid/missing
              fallback={
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="100%"
                    height="512"
                    viewBox="-48 0 512 512"
                  >
                    <path
                      fill="currentColor"
                      d="M96 416h224c0 17.7-14.3 32-32 32h-16c-17.7 0-32 14.3-32 32v20c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-20c0-17.7-14.3-32-32-32h-16c-17.7 0-32-14.3-32-32m320-208c0 74.2-39 139.2-97.5 176h-221C39 347.2 0 282.2 0 208C0 93.1 93.1 0 208 0s208 93.1 208 208m-180.1 43.9c18.3 0 33.1-14.8 33.1-33.1c0-14.4-9.3-26.3-22.1-30.9c9.6 26.8-15.6 51.3-41.9 41.9c4.6 12.8 16.5 22.1 30.9 22.1m49.1 46.9c0-14.4-9.3-26.3-22.1-30.9c9.6 26.8-15.6 51.3-41.9 41.9c4.6 12.8 16.5 22.1 30.9 22.1c18.3 0 33.1-14.9 33.1-33.1m64-64c0-14.4-9.3-26.3-22.1-30.9c9.6 26.8-15.6 51.3-41.9 41.9c4.6 12.8 16.5 22.1 30.9 22.1c18.3 0 33.1-14.9 33.1-33.1"
                    />
                  </svg>
                </span>
              }
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
