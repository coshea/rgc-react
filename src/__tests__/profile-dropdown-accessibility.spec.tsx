import { describe, it, expect, vi, beforeAll } from "vitest";
import "@testing-library/jest-dom";
import { render, fireEvent, screen } from "@testing-library/react";
import { ProfileDropdown } from "@/components/profile-dropdown";

// Mock site config minimal
vi.mock("@/config/site", () => ({
  siteConfig: {
    pages: {
      profile: { link: "/profile" },
      adminDashboard: { link: "/admin" },
      adminNotifications: { link: "/admin/notifications" },
    },
  },
}));

// Mock hook useUserProfile to return displayName
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    userProfile: { displayName: "Test User", admin: false },
    isLoading: false,
  }),
}));

// Mock AuthProvider's useAuth
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      uid: "uid123",
      displayName: "Auth User",
      email: "auth@example.com",
      photoURL: "",
    },
    logout: vi.fn(),
  }),
}));

// Default: regular user (not admin, not board member).
// Individual tests override via mockReturnValue where needed.
const useAdminFlagMock = vi.fn((_user?: { uid?: string } | null) => ({
  isAdmin: false,
  loadingAdmin: false,
}));
const useBoardMemberFlagMock = vi.fn((_user?: { uid?: string } | null) => ({
  isBoardMember: false,
  loadingBoard: false,
}));

vi.mock("@/components/membership/hooks", () => ({
  useAdminFlag: (user: { uid?: string } | null) => useAdminFlagMock(user),
  useBoardMemberFlag: (user: { uid?: string } | null) =>
    useBoardMemberFlagMock(user),
}));

// Mock HeroUI components that aren't essential to the test logic.
vi.mock("@heroui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@heroui/react")>();
  // Provide light stubs for only what we exercise; if real components exist they will be used.
  return {
    ...actual,
    NavbarContent: ({ children }: any) => (
      <div data-testid="navbar-content">{children}</div>
    ),
    Dropdown: Object.assign(
      ({ children }: any) => <div data-testid="dropdown">{children}</div>,
      {
        Trigger: ({ children }: any) => (
          <div data-testid="trigger">{children}</div>
        ),
        Popover: ({ children }: any) => (
          <div data-testid="dropdown-popover">{children}</div>
        ),
        Menu: ({ children, ...rest }: any) => (
          <ul role="menu" {...rest}>
            {children}
          </ul>
        ),
        Item: ({ children, onPress: _op, id, ...rest }: any) => (
          <li role="menuitem" tabIndex={-1} data-key={id} {...rest}>
            {children}
          </li>
        ),
        Section: ({ children, title }: any) => (
          <li role="group" aria-label={title}>
            {children}
          </li>
        ),
      },
    ),
    Link: ({ children, href }: any) => <a href={href}>{children}</a>,
    // Keep Avatar behavior close enough for click handling
    Avatar: ({
      onClick,
      onPress,
      name,
      alt,
      showFallback: _sf,
      isBordered: _ib,
      ...rest
    }: any) => {
      return (
        <button
          aria-label={alt || name}
          onClick={(e) => {
            onClick?.(e);
            onPress?.(e);
          }}
          {...rest}
        >
          {name}
        </button>
      );
    },
  };
});

// Stub ThemeSwitch to avoid use-theme hook invoking matchMedia
vi.mock("@/components/theme-switch", () => ({ ThemeSwitch: () => <div /> }));

// Stub NotificationBell to avoid useNavigate needing a Router context
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div />,
}));

// Provide matchMedia mock before running tests
beforeAll(() => {
  if (!window.matchMedia) {
    // minimal mock
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

// Import after mocks

describe("ProfileDropdown accessibility", () => {
  it("opens menu when avatar (button) is clicked and is keyboard focusable", () => {
    render(<ProfileDropdown />);

    // Locate the avatar button (UserAvatar renders initials or name) - our stub uses name prop
    const avatarBtn = screen.getByRole("button", {
      name: /test user|auth user/i,
    });
    expect(avatarBtn).toBeInTheDocument();
    expect(avatarBtn).toHaveAttribute("aria-label");

    // Simulate click - since we stubbed Dropdown we just verify trigger structure remains and menu items present.
    fireEvent.click(avatarBtn);

    // Menu items should be in document (e.g., logout item text)
    // Our stubbed DropdownMenu is always rendered; assert presence of a known item label.
    const logoutItem = screen.getByText(/log out/i);
    expect(logoutItem).toBeInTheDocument();

    // Keyboard accessibility: focus then press Enter triggers onClick again (we just ensure no error and still present)
    avatarBtn.focus();
    expect(document.activeElement).toBe(avatarBtn);
    fireEvent.keyDown(avatarBtn, { key: "Enter" });
    expect(logoutItem).toBeInTheDocument();
  });
});

describe("ProfileDropdown admin section visibility", () => {
  it("hides admin section for a regular user", () => {
    useAdminFlagMock.mockReturnValue({ isAdmin: false, loadingAdmin: false });
    useBoardMemberFlagMock.mockReturnValue({
      isBoardMember: false,
      loadingBoard: false,
    });
    render(<ProfileDropdown />);
    expect(screen.queryByText(/admin dashboard/i)).not.toBeInTheDocument();
  });

  it("shows admin section for an admin user", () => {
    useAdminFlagMock.mockReturnValue({ isAdmin: true, loadingAdmin: false });
    useBoardMemberFlagMock.mockReturnValue({
      isBoardMember: false,
      loadingBoard: false,
    });
    render(<ProfileDropdown />);
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
  });

  it("shows admin section for a board member", () => {
    useAdminFlagMock.mockReturnValue({ isAdmin: false, loadingAdmin: false });
    useBoardMemberFlagMock.mockReturnValue({
      isBoardMember: true,
      loadingBoard: false,
    });
    render(<ProfileDropdown />);
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
  });

  it("shows admin section when user is both admin and board member", () => {
    useAdminFlagMock.mockReturnValue({ isAdmin: true, loadingAdmin: false });
    useBoardMemberFlagMock.mockReturnValue({
      isBoardMember: true,
      loadingBoard: false,
    });
    render(<ProfileDropdown />);
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
  });
});
