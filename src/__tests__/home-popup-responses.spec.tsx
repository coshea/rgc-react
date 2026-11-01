import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  HOME_POPUP_ACTION,
  HOME_POPUP_AUDIENCE,
  HOME_POPUP_STATUS,
  type HomePopup,
} from "@/types/homePopup";

vi.mock("@/hooks/useHomePopups", () => ({
  useHomePopupResponses: () => ({
    isLoading: false,
    isError: false,
    data: [
      { uid: "u1", action: HOME_POPUP_ACTION.CLICKED, version: 2, link: "/membership" },
      { uid: "u2", action: HOME_POPUP_ACTION.CLICKED, version: 1, link: "/membership" },
      { uid: "u3", action: HOME_POPUP_ACTION.DISMISSED, version: 2 },
    ],
  }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map([
      ["u1", { id: "u1", displayName: "Alex Alpha" }],
      ["u2", { id: "u2", displayName: "Blair Bravo" }],
      ["u3", { id: "u3", displayName: "Casey Charlie" }],
    ]),
  }),
}));

import { HomePopupResponses } from "@/components/admin-dashboard/home-popup/home-popup-responses";

const popup: HomePopup = {
  id: "p1",
  title: "Memberships are open",
  body: "Renew now.",
  audience: HOME_POPUP_AUDIENCE.EVERYONE,
  status: HOME_POPUP_STATUS.PUBLISHED,
  startDate: new Date("2026-11-01T00:00:00Z"),
  version: 2,
  publishedAt: new Date("2026-11-01T12:00:00Z"),
};

describe("HomePopupResponses", () => {
  it("counts clicks and lists who clicked, then who closed it", () => {
    render(<HomePopupResponses popup={popup} />);
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("Alex Alpha")).toBeTruthy();
    expect(screen.getByText("Blair Bravo")).toBeTruthy();
    expect(screen.getByText(/earlier version/)).toBeTruthy();
    expect(screen.queryByText("Casey Charlie")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Closed" }));
    expect(screen.getByText("Casey Charlie")).toBeTruthy();
    expect(screen.queryByText("Alex Alpha")).toBeNull();
  });
});
