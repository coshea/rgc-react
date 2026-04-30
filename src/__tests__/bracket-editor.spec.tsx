/**
 * Tests for BracketEditor component.
 *
 * Focus areas:
 *  - Team label derivation (registrationToTeam)
 *  - Seed list rendering (seed chips, order, excluded state)
 *  - Exclude / include toggle logic
 *  - Seed re-numbering after exclusion
 *  - Generate button disabled / hint logic
 *  - "Not enough teams" empty state
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { BracketTeam } from "@/types/bracket";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Stub Firestore bracket API – onBracket resolves immediately with null (no bracket)
const mockOnBracket = vi.fn();
const mockSaveBracket = vi.fn().mockResolvedValue(undefined);
vi.mock("@/api/brackets", () => ({
  onBracket: (...args: Parameters<typeof mockOnBracket>) =>
    mockOnBracket(...args),
  saveBracket: (...args: unknown[]) => mockSaveBracket(...args),
  saveMatchResults: vi.fn().mockResolvedValue(undefined),
  deleteBracket: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/providers/toast", () => ({ addToast: vi.fn() }));

// Stub BracketView – not the focus here
vi.mock("@/components/bracket/BracketView", () => ({
  BracketView: () => <div data-testid="bracket-view">bracket-view-stub</div>,
}));

// Stub DnD Kit so tests run without pointer events
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  PointerSensor: class {},
  KeyboardSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: <T,>(arr: T[], from: number, to: number): T[] => {
    const a = [...arr];
    a.splice(to, 0, a.splice(from, 1)[0]);
    return a;
  },
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

// Deterministic shuffleTeams (identity) so seed order == registration order
vi.mock("@/utils/bracketGenerator", async () => {
  const actual = await vi.importActual<
    typeof import("@/utils/bracketGenerator")
  >("@/utils/bracketGenerator");
  return {
    ...actual,
    shuffleTeams: (teams: BracketTeam[]) => teams,
  };
});

// ── Import under test (after mocks are set up) ────────────────────────────────

import {
  BracketEditor,
  type RegistrationDoc,
} from "@/components/bracket/BracketEditor";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Simulates onBracket calling its callback with null (no bracket persisted). */
function simulateNoBracket() {
  mockOnBracket.mockImplementation(
    (_id: string, next: (b: null) => void, _onErr?: () => void) => {
      next(null);
      return () => {};
    },
  );
}

function reg(
  id: string,
  members: Array<{ id: string; displayName?: string }>,
): RegistrationDoc {
  return { id, team: members };
}

function renderEditor(registrations: RegistrationDoc[], tournamentId = "t1") {
  return render(
    <BracketEditor tournamentId={tournamentId} registrations={registrations} />,
  );
}

const TEAM_A = reg("reg-a", [{ id: "u1", displayName: "Alice" }]);
const TEAM_B = reg("reg-b", [
  { id: "u2", displayName: "Bob" },
  { id: "u3", displayName: "Carol" },
]);
const TEAM_C = reg("reg-c", [{ id: "u4", displayName: "Dave" }]);
const TEAM_D = reg("reg-d", [{ id: "u5", displayName: "Eve" }]);

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  simulateNoBracket();
});

// ── Registration label derivation ─────────────────────────────────────────────

describe("team label derivation", () => {
  it("uses the captain's displayName for a solo registration", () => {
    renderEditor([TEAM_A, TEAM_B]);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows all member names separated by '·' for multi-member registrations", () => {
    renderEditor([TEAM_A, TEAM_B]);
    expect(screen.getByText("Bob · Carol")).toBeInTheDocument();
  });

  it("falls back to 'Team XXXX' when no displayName is available", () => {
    const noName = reg("reg-z", [{ id: "u9" }]);
    renderEditor([noName, TEAM_A]);
    expect(screen.getByText(/^Team [A-Z0-9-]{4}$/)).toBeInTheDocument();
  });
});

// ── Seed list rendering ───────────────────────────────────────────────────────

describe("seed list rendering", () => {
  it("renders a seed chip for every registration", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C, TEAM_D]);
    // seed chips are labelled #1 … #4
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument();
  });

  it("shows an 'Exclude team from bracket' button for each team", () => {
    renderEditor([TEAM_A, TEAM_B]);
    const btns = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    expect(btns).toHaveLength(2);
  });

  it("renders the empty-state message when fewer than 2 registrations exist", () => {
    renderEditor([TEAM_A]);
    expect(
      screen.getByText(/at least 2 registered teams are needed/i),
    ).toBeInTheDocument();
  });

  it("renders the empty-state message when there are no registrations", () => {
    renderEditor([]);
    expect(screen.getByText(/no teams registered yet/i)).toBeInTheDocument();
  });
});

// ── Exclude / include toggle ──────────────────────────────────────────────────

describe("exclude / include toggle", () => {
  it("marks a team as excluded after clicking its exclude button", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C]);

    const [firstExclude] = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(firstExclude);

    // The button label should flip to "Include team in bracket"
    expect(
      screen.getByRole("button", { name: /include team in bracket/i }),
    ).toBeInTheDocument();
  });

  it("re-includes a team after clicking the include button", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C]);

    const [firstExclude] = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(firstExclude);

    const includeBtn = screen.getByRole("button", {
      name: /include team in bracket/i,
    });
    fireEvent.click(includeBtn);

    // Should now be back to all-exclude
    expect(
      screen.queryByRole("button", { name: /include team in bracket/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /exclude team from bracket/i }),
    ).toHaveLength(3);
  });

  it("shows the excluded team label in strikethrough (line-through class)", () => {
    renderEditor([TEAM_A, TEAM_B]);

    const [firstExclude] = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(firstExclude);

    // The span wrapping the label gains "line-through"
    const labelEl = screen.getByText("Alice");
    expect(labelEl).toHaveClass("line-through");
  });

  it("shows a '—' dash chip for excluded teams instead of a seed number", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C]);

    const [firstExclude] = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(firstExclude);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

// ── Seed re-numbering ─────────────────────────────────────────────────────────

describe("seed re-numbering", () => {
  it("renumbers seeds to skip excluded teams", () => {
    // 4 teams; exclude team at position 2 (seed #2)
    renderEditor([TEAM_A, TEAM_B, TEAM_C, TEAM_D]);

    // Exclude the second team (Bob · Carol at index 1 → originally #2)
    const excludeBtns = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(excludeBtns[1]);

    // Seeds should now be #1, #2, #3 for the 3 remaining included teams
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    // Old "#4" is gone (was team D, now becomes #3)
    expect(screen.queryByText("#4")).not.toBeInTheDocument();
  });

  it("seed 1 badge retains a warning colour class", () => {
    renderEditor([TEAM_A, TEAM_B]);
    const seed1 = screen.getByText("#1");
    // HeroUI Chip with color="warning" applies bg-warning/* to the container div
    expect(seed1.closest("div")?.className).toContain("warning");
  });
});

// ── Generate button state ─────────────────────────────────────────────────────

describe("Generate Bracket button", () => {
  it("is enabled when 2 or more teams are included", () => {
    renderEditor([TEAM_A, TEAM_B]);
    const btn = screen.getByRole("button", { name: /generate bracket/i });
    expect(btn).not.toBeDisabled();
  });

  it("is disabled when fewer than 2 teams are included", () => {
    renderEditor([TEAM_A, TEAM_B]);

    // Exclude all but one team
    const [firstExclude] = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(firstExclude);

    const btn = screen.getByRole("button", { name: /generate bracket/i });
    expect(btn).toBeDisabled();
  });

  it("does not show the team-count hint when no teams are excluded", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C]);
    expect(screen.queryByText(/teams\)/)).not.toBeInTheDocument();
  });

  it("shows the team-count hint when at least one team is excluded", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C]);

    const [firstExclude] = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(firstExclude);

    // hint reads "(2 teams)"
    expect(screen.getByText(/2\s*teams/i)).toBeInTheDocument();
  });

  it("updates the team count in the hint as more teams are excluded", () => {
    renderEditor([TEAM_A, TEAM_B, TEAM_C, TEAM_D]);

    const excludeBtns = screen.getAllByRole("button", {
      name: /exclude team from bracket/i,
    });
    fireEvent.click(excludeBtns[0]); // 3 included
    expect(screen.getByText(/3\s*teams/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: /exclude team from bracket/i })[0],
    );
    expect(screen.getByText(/2\s*teams/i)).toBeInTheDocument();
  });
});
