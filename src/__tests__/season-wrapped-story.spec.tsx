import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import { buildCards } from "@/components/season-wrapped/build-cards";
import { WrappedStory } from "@/components/season-wrapped/wrapped-story";
import { makeSeason, makeStory } from "./season-wrapped-fixtures";

// Record which user/photo each avatar gets (jsdom never loads images).
vi.mock("@/components/avatar", () => ({
  UserAvatar: ({
    user,
    name,
  }: {
    user?: { displayName?: string; profileURL?: string };
    name?: string;
  }) => (
    <span
      aria-label={user?.displayName ?? name}
      data-photo={user?.profileURL ?? ""}
    />
  ),
}));

describe("buildCards", () => {
  it("leaves out personal cards the member has no data for", () => {
    const ids = buildCards(makeSeason(), makeStory()).map((c) => c.id);
    expect(ids).toEqual([
      "intro",
      "events",
      "money",
      "club",
      "podium",
      "major:club-championship",
      "major:presidents-cup:p1",
      "tribute",
      "share",
    ]);
  });

  it("gives members who didn't play only the club half", () => {
    const story = makeStory({
      played: false,
      events: undefined,
      money: undefined,
    });
    const ids = buildCards(makeSeason(), story).map((c) => c.id);
    expect(ids[0]).toBe("intro");
    expect(ids[1]).toBe("club");
    expect(ids).not.toContain("events");
  });
});

describe("WrappedStory", () => {
  function renderStory() {
    const season = makeSeason();
    const story = makeStory();
    const calls: number[] = [];
    render(
      <MemoryRouter>
        <WrappedStory
          season={season}
          story={story}
          cards={buildCards(season, story)}
          onCardChange={(i) => calls.push(i)}
          shareSlot={<p>Share controls</p>}
          usersById={
            new Map([
              [
                "jd",
                {
                  id: "jd",
                  displayName: "Joe Duarte",
                  profileURL: "https://example.com/jd.png",
                },
              ],
            ])
          }
        />
      </MemoryRouter>,
    );
    return calls;
  }

  it("steps through cards with Next and Back", () => {
    const calls = renderStory();
    expect(screen.getByText("Your season, Mike")).toBeInTheDocument();
    expect(screen.getByText("1 / 9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("2 / 9")).toBeInTheDocument();
    expect(
      screen.getByText(/out of 14 on the 2026 calendar/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("1 / 9")).toBeInTheDocument();
    expect(calls).toEqual([0, 1, 0]);
  });

  it("shows every Club Championship flight and the member's result", () => {
    renderStory();
    for (let i = 0; i < 5; i++)
      fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // The title carries a soft hyphen (Champ-ionship) for line breaking.
    expect(screen.getByText("Club Champ\u00ADionship")).toBeInTheDocument();
    expect(screen.getByText("Club Champion")).toBeInTheDocument();
    expect(screen.getByText("Club Tee Champion")).toBeInTheDocument();
    expect(screen.getByText("Senior Club Champion")).toBeInTheDocument();
    expect(screen.getByText("You · Runner-up, Club Tee")).toBeInTheDocument();
  });

  it("shows a member's photo when they have one", () => {
    renderStory();
    for (let i = 0; i < 4; i++)
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("The podium")).toBeInTheDocument();
    const joe = screen.getAllByLabelText("Joe Duarte")[0];
    expect(joe).toHaveAttribute("data-photo", "https://example.com/jd.png");
    // Members without a profile fall back to initials from their name.
    expect(screen.getAllByLabelText("Ray Wells")[0]).toHaveAttribute(
      "data-photo",
      "",
    );
  });

  it("lists the tournaments the member won money in", () => {
    renderStory();
    for (let i = 0; i < 2; i++)
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Spring Two-Man Scramble")).toBeInTheDocument();
    expect(screen.getByText("1st · $160")).toBeInTheDocument();
    expect(screen.getByText("CTP · $25")).toBeInTheDocument();
  });

  it("ends with the tribute and then the share card", () => {
    renderStory();
    for (let i = 0; i < 7; i++)
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Thank you, Frank.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Share controls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
