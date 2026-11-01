import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  HOME_POPUP_AUDIENCE,
  HOME_POPUP_STATUS,
  type HomePopup,
} from "@/types/homePopup";

const popups: HomePopup[] = [
  {
    id: "live",
    title: "Memberships are open",
    body: "Renew now.",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
    status: HOME_POPUP_STATUS.PUBLISHED,
    startDate: new Date("2026-11-01T00:00:00Z"),
    version: 1,
    publishedAt: new Date("2026-11-01T12:00:00Z"),
  },
  {
    id: "draft",
    title: "Club event",
    body: "Soon.",
    audience: HOME_POPUP_AUDIENCE.MEMBERS,
    status: HOME_POPUP_STATUS.DRAFT,
    startDate: new Date("2026-12-01T00:00:00Z"),
    version: 1,
  },
];

const countsFor = vi.hoisted(() => vi.fn());

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "admin" }, loading: false }),
}));

vi.mock("@/utils/admin", () => ({
  useAdminFlag: () => ({ isAdmin: true, loadingAdmin: false }),
}));

vi.mock("@/hooks/useHomePopups", () => ({
  useAllHomePopups: () => ({ data: popups, isLoading: false, isError: false }),
  useHomePopupResponseCounts: countsFor,
}));

import { HomePopupTab } from "@/components/admin-dashboard/home-popup/home-popup-tab";

describe("HomePopupTab", () => {
  it("shows click totals on popups that have been live", () => {
    countsFor.mockReturnValue({ live: { clicked: 12, dismissed: 28 } });
    render(<HomePopupTab />);

    // Drafts that were never published aren't counted.
    expect(countsFor).toHaveBeenCalledWith(["live"]);
    const row = screen.getByRole("button", { name: /Memberships are open/ });
    expect(row.textContent).toContain("12 clicked");
    expect(row.textContent).toContain("28 closed · 30%");
    expect(
      screen.getByRole("button", { name: /Club event/ }).textContent,
    ).not.toContain("clicked");
  });
});
