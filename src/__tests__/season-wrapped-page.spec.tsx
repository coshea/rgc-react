import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import SeasonWrappedPage from "@/pages/season-wrapped";
import { makeSeason, makeStory } from "./season-wrapped-fixtures";

const recordWrappedView = vi.fn((..._args: unknown[]) => Promise.resolve());
let isAdmin = false;
let storyUid = "me";
let status: "draft" | "published" = "published";

vi.mock("@/api/seasonWrapped", () => ({
  recordWrappedView: (...args: unknown[]) => recordWrappedView(...args),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "me" }, loading: false }),
}));

vi.mock("@/utils/admin", () => ({
  useAdminFlag: () => ({ isAdmin, loadingAdmin: false }),
}));

vi.mock("@/hooks/usePageTracking", () => ({ usePageTracking: () => {} }));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

vi.mock("@/hooks/useSeasonWrapped", () => ({
  useWrappedSeason: () => ({ data: makeSeason({ status }), isLoading: false, isError: false }),
  useWrappedStory: (_year: number, uid: string | undefined) => ({
    data: uid ? makeStory({ uid: storyUid, displayName: storyUid === "me" ? "Mike Reynolds" : "Ray Wells" }) : undefined,
    isLoading: false,
    isError: false,
  }),
  useWrappedShareImage: () => ({ data: undefined, isFetching: false, isError: false }),
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/wrapped/:year" element={<SeasonWrappedPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SeasonWrappedPage open tracking", () => {
  beforeEach(() => {
    recordWrappedView.mockClear();
    isAdmin = false;
    storyUid = "me";
    status = "published";
  });

  it("records the member's own open with its source", () => {
    renderAt("/wrapped/2026?utm_source=resend");
    expect(screen.getByText("Your season, Mike")).toBeInTheDocument();
    expect(recordWrappedView).toHaveBeenCalledWith(
      2026,
      "me",
      expect.objectContaining({ source: "email", newOpen: true, card: 1 }),
    );
  });

  it("doesn't count an admin previewing another member", () => {
    isAdmin = true;
    storyUid = "rw";
    renderAt("/wrapped/2026?member=rw");
    expect(screen.getByText(/Preview of Ray Wells's story/)).toBeInTheDocument();
    expect(recordWrappedView).not.toHaveBeenCalled();
  });

  it("doesn't count views of a draft", () => {
    isAdmin = true;
    status = "draft";
    renderAt("/wrapped/2026");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(recordWrappedView).not.toHaveBeenCalled();
  });
});
