import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import BoardOfGovernorsPage from "@/pages/board-of-governors";
import type { EnrichedBoardMember } from "@/hooks/useBoardMembers";
import { BOARD_ROLE_META } from "@/types/roles";

vi.mock("@/hooks/usePageTracking", () => ({
  usePageTracking: () => {},
}));

const members: EnrichedBoardMember[] = [
  {
    id: "u1",
    email: "joe@example.com",
    displayName: "Joe Moorhead",
    boardMember: true,
    role: "President",
    normalizedRole: "President",
    roleLabel: "President",
    rolePriority: 1,
    roleMeta: BOARD_ROLE_META.President,
    isPresident: true,
  },
  {
    id: "u2",
    email: "dan@example.com",
    displayName: "Daniel Scalzi",
    boardMember: true,
    role: "Board Member",
    normalizedRole: "Board Member",
    roleLabel: "Board Member",
    rolePriority: 7,
    roleMeta: BOARD_ROLE_META["Board Member"],
    isPresident: false,
  },
];

let mockState = { boardMembers: members, isLoading: false };

vi.mock("@/hooks/useBoardMembers", () => ({
  useBoardMembers: () => mockState,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BoardOfGovernorsPage />
    </MemoryRouter>,
  );
}

describe("BoardOfGovernorsPage", () => {
  it("shows each board member in order with their title, linking to their profile", () => {
    mockState = { boardMembers: members, isLoading: false };
    renderPage();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Joe Moorhead")).toBeInTheDocument();
    expect(within(items[0]).getByText("President")).toBeInTheDocument();
    expect(within(items[1]).getByText("Board Member")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "View profile for Joe Moorhead" }),
    ).toHaveAttribute("href", "/profile/u1");
  });

  it("shows an empty message when there are no board members", () => {
    mockState = { boardMembers: [], isLoading: false };
    renderPage();

    expect(
      screen.getByText("No board members are listed yet"),
    ).toBeInTheDocument();
  });
});
