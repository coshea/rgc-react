import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ user: { uid: "user-1" } }));
const userProfileMock = vi.hoisted(() => ({
  userProfile: { notificationPreferences: {} },
  isLoading: false,
}));
const fcmTokenMock = vi.hoisted(() => ({
  requestPermission: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => authMock,
}));

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => userProfileMock,
}));

vi.mock("@/hooks/useFCMToken", () => ({
  useFCMToken: () => fcmTokenMock,
}));

vi.mock("@/api/users", () => ({
  saveNotificationPreferences: vi.fn(async () => undefined),
}));

vi.mock("@/providers/toast", () => ({
  addToast: vi.fn(),
}));

vi.mock("@/components/back-button", () => ({
  __esModule: true,
  default: () => <div>Back</div>,
}));

vi.mock("@/hooks/usePageTracking", () => ({
  usePageTracking: vi.fn(),
}));

vi.mock("firebase/messaging", () => ({
  isSupported: vi.fn(async () => false),
}));

function setNavigatorValues({
  userAgent,
  platform,
  maxTouchPoints,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

describe("NotificationSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows iPhone notification setup instructions on iPhone devices", async () => {
    setNavigatorValues({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    });

    const { default: NotificationSettingsPage } =
      await import("@/pages/notification-settings");

    render(<NotificationSettingsPage />);

    expect(screen.getByText(/iPhone setup required/i)).toBeInTheDocument();
    expect(screen.getByText(/Add to Home Screen/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Home Screen app, not a regular Safari tab/i),
    ).toBeInTheDocument();
  });

  it("does not show iPhone instructions on Android devices", async () => {
    setNavigatorValues({
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    });

    const { default: NotificationSettingsPage } =
      await import("@/pages/notification-settings");

    render(<NotificationSettingsPage />);

    expect(screen.queryByText(/iPhone setup required/i)).toBeNull();
  });
});
