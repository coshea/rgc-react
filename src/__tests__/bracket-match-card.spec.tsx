import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BracketMatchCard } from "@/components/bracket/BracketMatchCard";
import type { BracketMatch, BracketTeam } from "@/types/bracket";

vi.mock("@/components/avatar", () => ({
  UserAvatar: ({ name }: { name?: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, className }: { icon: string; className?: string }) => (
    <span data-icon={icon} className={className} aria-hidden="true" />
  ),
}));

function buildTeam(id: string, name: string): BracketTeam {
  return {
    id,
    name,
    memberIds: [`${id}-uid`],
    memberNames: [name],
  };
}

function buildMatch(): BracketMatch {
  return {
    id: "match-1",
    round: 1,
    position: 0,
    nextMatchId: "match-2",
    team1Id: "team-1",
    team2Id: "team-2",
    winnerId: null,
  };
}

describe("BracketMatchCard highlight visual", () => {
  it("applies the highlighted border, shadow, and info icon color", () => {
    const teamMap = new Map<string, BracketTeam>([
      ["team-1", buildTeam("team-1", "Chris O")],
      ["team-2", buildTeam("team-2", "Chris O'Shea")],
    ]);

    const { container } = render(
      <BracketMatchCard
        match={buildMatch()}
        teamMap={teamMap}
        width={320}
        slotHeight={72}
        onTeamPress={vi.fn()}
        isHighlighted
      />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).toHaveClass("border-primary");
    expect(card).toHaveClass("shadow-primary/20");

    const infoIcon = container.querySelector('[data-icon="lucide:info"]');
    expect(infoIcon).toBeTruthy();
    expect(infoIcon).toHaveClass("text-primary");
  });

  it("keeps the default muted info icon when not highlighted", () => {
    const teamMap = new Map<string, BracketTeam>([
      ["team-1", buildTeam("team-1", "Chris O")],
      ["team-2", buildTeam("team-2", "Chris O'Shea")],
    ]);

    const { container } = render(
      <BracketMatchCard
        match={buildMatch()}
        teamMap={teamMap}
        width={320}
        slotHeight={72}
        onTeamPress={vi.fn()}
      />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card).not.toHaveClass("border-primary");
    expect(card).not.toHaveClass("shadow-primary/20");

    const infoIcon = container.querySelector('[data-icon="lucide:info"]');
    expect(infoIcon).toHaveClass("text-muted");
  });
});
