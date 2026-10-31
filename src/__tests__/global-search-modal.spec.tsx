import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { siteConfig } from "@/config/site";
import { TournamentStatus } from "@/types/tournament";

const navigateMock = vi.fn();
const tournamentsState = { isLoading: false };

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => navigateMock,
}));

vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => ({
    isLoading: tournamentsState.isLoading,
    tournaments: [
      {
        firestoreId: "t1",
        title: "Spring Scramble",
        date: new Date("2026-04-12T00:00:00Z"),
        status: TournamentStatus.Completed,
      },
      {
        firestoreId: "t2",
        title: "Club Championship",
        date: new Date("2026-09-06T00:00:00Z"),
        status: TournamentStatus.Upcoming,
      },
    ],
  }),
}));

const directory = siteConfig.pages.directory;

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: text } });
}

function results() {
  return screen.getByRole("menu", { name: "Search results" });
}

describe("GlobalSearchModal", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    tournamentsState.isLoading = false;
  });

  it("lists searchable pages but no tournaments before typing", () => {
    render(<GlobalSearchModal isOpen onClose={vi.fn()} />);

    expect(
      within(results()).getByRole("group", { name: "Pages" }),
    ).toBeInTheDocument();
    expect(
      within(results()).getByRole("menuitem", {
        name: new RegExp(directory.title),
      }),
    ).toBeInTheDocument();
    // A page is also called "Tournaments", so check the group, not the text.
    expect(
      within(results()).queryByRole("group", { name: "Tournaments" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Type to search pages and tournaments"),
    ).toBeInTheDocument();
  });

  it("leaves admin and auth pages out", () => {
    render(<GlobalSearchModal isOpen onClose={vi.fn()} />);

    expect(
      within(results()).queryByRole("menuitem", {
        name: new RegExp(siteConfig.pages.login.title),
      }),
    ).not.toBeInTheDocument();
  });

  it("finds tournaments by title once the member types", () => {
    render(<GlobalSearchModal isOpen onClose={vi.fn()} />);
    search("scramble");

    expect(
      within(results()).getByRole("group", { name: "Tournaments" }),
    ).toBeInTheDocument();
    const item = within(results()).getByRole("menuitem", {
      name: /Spring Scramble/,
    });
    expect(item).toHaveTextContent("Apr 12, 2026");
    expect(
      within(results()).queryByRole("menuitem", { name: /Club Championship/ }),
    ).not.toBeInTheDocument();
  });

  it("matches pages by their description", () => {
    render(<GlobalSearchModal isOpen onClose={vi.fn()} />);
    search(directory.description.split(" ").slice(0, 2).join(" "));

    expect(
      within(results()).getByRole("menuitem", {
        name: new RegExp(directory.title),
      }),
    ).toBeInTheDocument();
  });

  it("shows an empty message when nothing matches", () => {
    render(<GlobalSearchModal isOpen onClose={vi.fn()} />);
    search("zzqx");

    expect(screen.getByText(/No results for/)).toHaveTextContent(
      "No results for “zzqx”",
    );
  });

  it("navigates to a chosen result and closes", () => {
    const onClose = vi.fn();
    render(<GlobalSearchModal isOpen onClose={onClose} />);
    search("championship");

    fireEvent.click(
      within(results()).getByRole("menuitem", { name: /Club Championship/ }),
    );
    expect(navigateMock).toHaveBeenCalledWith("/tournaments/t2");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a spinner while tournaments load", () => {
    tournamentsState.isLoading = true;
    render(<GlobalSearchModal isOpen onClose={vi.fn()} />);
    search("spring");

    expect(screen.getByLabelText("Loading tournaments")).toBeInTheDocument();
  });

  it("closes from the close button", () => {
    const onClose = vi.fn();
    render(<GlobalSearchModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(<GlobalSearchModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
