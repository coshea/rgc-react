import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyTeamWinners } from "@/components/yearly-team-winners";

// Shim SearchInput so fireEvent.change triggers the onChange prop
vi.mock("@/components/search-input", () => ({
  SearchInput: ({ value, onChange, ariaLabel, placeholder }: any) => (
    <input
      type="text"
      role="textbox"
      aria-label={ariaLabel ?? placeholder ?? "Search"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, user: { uid: "C" } }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => ({
    isLoading: false,
    tournaments: [
      {
        firestoreId: "t1",
        title: "Spring Scramble",
        date: new Date("2025-04-10"),
        winnerGroups: [
          {
            id: "overall",
            label: "Overall",
            type: "overall",
            order: 1,
            winners: [
              {
                place: 1,
                competitors: [
                  { userId: "A", displayName: "Alice" },
                  { userId: "B", displayName: "Bob" },
                ],
                prizeAmount: 50,
                score: "65",
              },
              {
                place: 2,
                competitors: [
                  { userId: "C", displayName: "Carol" },
                  { userId: "D", displayName: "Dan" },
                ],
                prizeAmount: 30,
              },
            ],
          },
        ],
      },
      {
        firestoreId: "t2",
        title: "Better Ball",
        date: new Date("2025-05-12"),
        winnerGroups: [
          {
            id: "overall",
            label: "Overall",
            type: "overall",
            order: 1,
            winners: [
              {
                place: 3,
                competitors: [
                  { userId: "A", displayName: "Alice" },
                  { userId: "B", displayName: "Bob" },
                ],
                prizeAmount: 20,
              },
              {
                place: 1,
                competitors: [
                  { userId: "E", displayName: "Evan" },
                  { userId: "F", displayName: "Frank" },
                ],
                prizeAmount: 55,
              },
            ],
          },
        ],
      },
    ],
  }),
}));

const card = (label: RegExp) => screen.getByLabelText(label);

describe("YearlyTeamWinners", () => {
  it("shows each team as a card with rank, stats and per-player money", () => {
    render(<YearlyTeamWinners year={2025} />);
    expect(
      screen.getByText(/3 teams won \$310 across 2 team events/),
    ).toBeInTheDocument();

    const ab = card(/^1st, Alice and Bob$/);
    expect(within(ab).getByText("2 events, 1 win")).toBeInTheDocument();
    expect(within(ab).getByText("$70")).toBeInTheDocument();
    expect(within(ab).getByText("each")).toBeInTheDocument();

    const ef = card(/^2nd, Evan and Frank$/);
    expect(within(ef).getByText("1 event, 1 win")).toBeInTheDocument();

    const cd = card(/^3rd, Carol and Dan, your team$/);
    expect(within(cd).getByText("1 event")).toBeInTheDocument();
    expect(within(cd).getByText("Your team")).toBeInTheDocument();
  });

  it("lists finishes newest first with ordinal places and UTC dates", () => {
    render(<YearlyTeamWinners year={2025} />);
    const list = screen.getByRole("list", {
      name: "Finishes for Alice and Bob",
    });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("3rd");
    expect(rows[0]).toHaveTextContent("Better Ball");
    expect(rows[0]).toHaveTextContent("May 12, Overall");
    expect(rows[1]).toHaveTextContent("1st");
    expect(rows[1]).toHaveTextContent("Apr 10, Overall");
    expect(
      within(rows[1]).getByRole("link", { name: "Spring Scramble" }),
    ).toHaveAttribute("href", "/tournaments/t1");
  });

  it("filters teams via search input", () => {
    render(<YearlyTeamWinners year={2025} />);
    const input = screen.getByRole("textbox", { name: /find a team/i });
    fireEvent.change(input, { target: { value: "alice" } });
    expect(card(/^1st, Alice and Bob$/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^2nd, Evan and Frank$/)).toBeNull();
    expect(screen.queryByLabelText(/^3rd, Carol and Dan/)).toBeNull();
  });
});
