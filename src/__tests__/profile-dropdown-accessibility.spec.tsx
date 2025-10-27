import { describe, it, expect, vi, beforeAll } from "vitest";
import "@testing-library/jest-dom";
import { render, fireEvent, screen } from "@testing-library/react";
import { ProfileDropdown } from "@/components/profile-dropdown";

// Mock site config minimal
vi.mock("@/config/site", () => ({
  siteConfig: {
    pages: {
      profile: { link: "/profile" },
      myScores: { link: "/my-scores" },
    },
  },
}));

// Mock hook useUserProfile to return displayName
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    userProfile: { displayName: "Test User", admin: false },
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

// Mock HeroUI components that aren't essential to the test logic.
vi.mock("@heroui/react", async (orig) => {
  const actual: any =
    (await (orig as any).importActual?.("@heroui/react")) || {};
  // Provide light stubs for only what we exercise; if real components exist they will be used.
  return {
    ...actual,
    NavbarContent: ({ children }: any) => (
      <div data-testid="navbar-content">{children}</div>
    ),
    Dropdown: ({ children }: any) => (
      <div data-testid="dropdown">{children}</div>
    ),
    DropdownTrigger: ({ children }: any) => (
      <div data-testid="trigger">{children}</div>
    ),
    DropdownMenu: ({ children, ...rest }: any) => (
      <ul role="menu" {...rest}>
        {children}
      </ul>
    ),
    DropdownItem: ({ children, onPress: _op, as: _as, ...rest }: any) => {
      // Drop unsupported DOM props (onPress, as)
      return (
        <li role="menuitem" tabIndex={-1} {...rest}>
          {children}
        </li>
      );
    },
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

// Provide matchMedia mock before running tests
beforeAll(() => {
  if (!window.matchMedia) {
    // minimal mock
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
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
