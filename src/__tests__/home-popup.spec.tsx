import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { HOME_POPUP_AUDIENCE, HOME_POPUP_STATUS, type HomePopup as HomePopupDoc } from "@/types/homePopup";

const state = vi.hoisted(() => ({
  user: null as { uid: string } | null,
  published: [] as unknown[],
  remote: {} as Record<string, number>,
  dismiss: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: state.user, loading: false }),
}));

vi.mock("@/hooks/useHomePopups", () => ({
  usePublishedHomePopups: () => ({ data: state.published, isLoading: false }),
  useHomePopupDismissals: () => ({ data: state.remote, isLoading: false }),
  useDismissHomePopup: () => ({ mutate: state.dismiss }),
}));

import { HomePopup } from "@/components/home-popup/home-popup";

function livePopup(overrides: Partial<HomePopupDoc> = {}): HomePopupDoc {
  return {
    id: "p1",
    title: "2027 memberships are open",
    body: "Renew before the first tournament.",
    ctaLabel: "Renew membership",
    ctaLink: "/membership",
    audience: HOME_POPUP_AUDIENCE.EVERYONE,
    status: HOME_POPUP_STATUS.PUBLISHED,
    startDate: new Date("2020-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePopup />} />
        <Route path="/membership" element={<p>Membership page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HomePopup", () => {
  beforeEach(() => {
    localStorage.clear();
    state.user = null;
    state.published = [livePopup()];
    state.remote = {};
    state.dismiss.mockReset();
  });

  it("shows a live popup and dismisses it on Not now", async () => {
    renderHome();
    expect(await screen.findByText("2027 memberships are open")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(state.dismiss).toHaveBeenCalledWith({
      id: "p1",
      version: 1,
      response: { action: "dismissed", link: undefined },
    });
  });

  it("dismisses and navigates when the button is pressed", async () => {
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Renew membership" }));
    expect(state.dismiss).toHaveBeenCalledWith({
      id: "p1",
      version: 1,
      response: { action: "clicked", link: "/membership" },
    });
    expect(await screen.findByText("Membership page")).toBeTruthy();
  });

  it("stays hidden once dismissed on this device", () => {
    localStorage.setItem("rgc.homePopupDismissals", JSON.stringify({ p1: 1 }));
    renderHome();
    expect(screen.queryByText("2027 memberships are open")).toBeNull();
  });

  it("stays hidden when the member dismissed it on another device", () => {
    state.user = { uid: "u1" };
    state.remote = { p1: 1 };
    renderHome();
    expect(screen.queryByText("2027 memberships are open")).toBeNull();
  });

  it("shows again after the version is bumped", async () => {
    localStorage.setItem("rgc.homePopupDismissals", JSON.stringify({ p1: 1 }));
    state.published = [livePopup({ version: 2 })];
    renderHome();
    expect(await screen.findByText("2027 memberships are open")).toBeTruthy();
  });

  it("shows a visitors-only welcome to visitors but not to members", async () => {
    state.published = [livePopup({ audience: HOME_POPUP_AUDIENCE.VISITORS })];
    const { unmount } = renderHome();
    expect(await screen.findByText("2027 memberships are open")).toBeTruthy();
    unmount();
    state.user = { uid: "u1" };
    renderHome();
    expect(screen.queryByText("2027 memberships are open")).toBeNull();
  });

  it("copies a dismissal made before signing in to the member's account", () => {
    localStorage.setItem("rgc.homePopupDismissals", JSON.stringify({ p1: 1 }));
    state.user = { uid: "u1" };
    renderHome();
    expect(screen.queryByText("2027 memberships are open")).toBeNull();
    expect(state.dismiss).toHaveBeenCalledWith({ id: "p1", version: 1 });
  });

  it("never shows a members-only popup to visitors", () => {
    state.published = [livePopup({ audience: HOME_POPUP_AUDIENCE.MEMBERS })];
    renderHome();
    expect(screen.queryByText("2027 memberships are open")).toBeNull();
  });
});

describe("HomePopup message links", () => {
  beforeEach(() => {
    localStorage.clear();
    state.user = null;
    state.remote = {};
    state.dismiss.mockReset();
  });

  it("routes a relative link in the app instead of opening a new tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    state.published = [livePopup({ body: "Please [join](membership) today." })];
    renderHome();
    fireEvent.click(await screen.findByRole("link", { name: "join" }));
    expect(open).not.toHaveBeenCalled();
    expect(await screen.findByText("Membership page")).toBeTruthy();
    expect(state.dismiss).toHaveBeenCalledWith(
      expect.objectContaining({ response: { action: "clicked", link: "/membership" } }),
    );
    open.mockRestore();
  });

  it("lets the browser handle a modifier-click but still records it", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    state.published = [livePopup({ body: "Please [join](/membership) today." })];
    renderHome();
    const link = await screen.findByRole("link", { name: "join" });
    // `true` means nothing called preventDefault, so the browser opens it.
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByText("Membership page")).toBeNull();
    expect(state.dismiss).toHaveBeenCalledWith(
      expect.objectContaining({ response: { action: "clicked", link: "/membership" } }),
    );
    open.mockRestore();
  });
});
