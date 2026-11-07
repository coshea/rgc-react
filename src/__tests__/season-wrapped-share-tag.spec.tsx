import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import { WrappedCard } from "@/components/season-wrapped/wrapped-cards";
import type { SeasonWrappedMember } from "@@/seasonWrapped/types";
import { makeSeason, makeStory } from "./season-wrapped-fixtures";

function renderShare(story: SeasonWrappedMember) {
  const { container } = render(
    <MemoryRouter>
      <WrappedCard spec={{ id: "share" }} season={makeSeason()} story={story} index={9} total={10} />
    </MemoryRouter>,
  );
  return container;
}

describe("share card bag tag", () => {
  it("shows the season, the member's initials and a Money List seal", () => {
    const container = renderShare(makeStory());
    const tag = container.querySelector<HTMLElement>(".wr-sharecard");
    expect(tag?.style.getPropertyValue("--tag-color")).toBe("#2c8a4b");
    expect(container.querySelector(".wr-tag-year")).toHaveTextContent("2026");
    expect(screen.getByText("MR")).toBeInTheDocument();
    expect(container.querySelector(".wr-seal")).toHaveTextContent("Money list");
    expect(container.querySelector(".wr-seal")).toHaveTextContent("#7");
  });

  it("puts a championship ahead of the Money List and changes color by year", () => {
    const container = renderShare(makeStory({ year: 2027, championshipsWon: ["Club Champion"] }));
    expect(container.querySelector(".wr-seal")).toHaveTextContent("Club Champion");
    expect(container.querySelector(".wr-seal")).not.toHaveTextContent("Money list");
    const tag = container.querySelector<HTMLElement>(".wr-sharecard");
    expect(tag?.style.getPropertyValue("--tag-color")).not.toBe("#2c8a4b");
  });

  it("has no seal outside the top 25 without other wins", () => {
    const story = makeStory({ money: { total: 20, rank: 30, rankLabel: "30", rankedMembers: 64, paidEvents: [] } });
    const container = renderShare(story);
    expect(container.querySelector(".wr-seal")).toBeNull();
  });
});
