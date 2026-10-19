import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import { WrappedCard } from "@/components/season-wrapped/wrapped-cards";
import { makeSeason, makeStory } from "./season-wrapped-fixtures";

function renderCtp(aces: { date: string; hole?: number }[]) {
  const { container } = render(
    <MemoryRouter>
      <WrappedCard
        spec={{ id: "closest-to-pin" }}
        season={makeSeason()}
        story={makeStory({ closestToPin: { count: 0, holes: [], aces } })}
        index={3}
        total={10}
      />
    </MemoryRouter>,
  );
  return container;
}

describe("closest-to-pin card aces", () => {
  it("marks an ace with a hole on the scorecard", () => {
    const container = renderCtp([{ date: "2026-07-01", hole: 7 }]);
    expect(screen.getByRole("img", { name: "hole in one on hole 7" })).toBeInTheDocument();
    expect(container.querySelectorAll(".wr-scorecard .ace")).toHaveLength(1);
    expect(container.querySelector(".wr-cup")).toBeNull();
    expect(screen.getByText(/Hole in one on hole 7/)).toBeInTheDocument();
  });

  it("rolls the ball into the cup when the ace has no hole", () => {
    const container = renderCtp([{ date: "2026-07-01" }]);
    expect(container.querySelector(".wr-scorecard")).toBeNull();
    expect(container.querySelector(".wr-cup")).not.toBeNull();
  });
});
