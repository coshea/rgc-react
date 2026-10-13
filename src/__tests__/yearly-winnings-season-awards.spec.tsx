import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true }),
}));

vi.mock("@/hooks/useYearlyWinnings", () => ({
  useYearlyWinnings: () => ({
    isLoading: false,
    winnings: [
      {
        userId: "u1",
        displayName: "Alice",
        total: 150,
        tournamentTotal: 100,
        seasonAwardsTotal: 50,
        breakdown: [
          {
            tournamentId: "t1",
            title: "Winter Classic",
            place: 1,
            amount: 100,
            // Tournament dates are date-only, stored as midnight UTC.
            date: new Date("2025-02-15T00:00:00Z"),
            source: "tournament",
          },
          {
            tournamentId: "season-award:a1",
            title: "Hole in One Award",
            place: 0,
            amount: 50,
            date: new Date("2025-06-20T12:00:00Z"),
            source: "season-award",
          },
        ],
      },
      {
        userId: "u2",
        displayName: "Bob",
        total: 90,
        tournamentTotal: 90,
        seasonAwardsTotal: 0,
        breakdown: [
          {
            tournamentId: "t1",
            title: "Winter Classic",
            place: 2,
            amount: 90,
            date: new Date("2025-02-15T00:00:00Z"),
            source: "tournament",
          },
        ],
      },
    ],
  }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

vi.mock("@/components/avatar", () => ({
  UserAvatar: ({ name }: { name?: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

describe("YearlyWinningsStandings season awards", () => {
  it("includes season awards in the summary and the breakdown", () => {
    render(<YearlyWinningsStandings year={2025} />);

    expect(
      screen.getByText(/\$190 paid to 2 players across 1 tournament, plus \$50 in season awards\./),
    ).toBeInTheDocument();

    const list = screen.getByRole("list", { name: /^standings$/i });
    const aliceRow = within(list).getAllByRole("listitem")[0];
    fireEvent.click(within(aliceRow).getByRole("button", { name: /alice/i }));

    const earnings = screen.getByRole("list", { name: /alice earnings/i });
    expect(within(earnings).getByRole("link", { name: "Winter Classic" })).toHaveAttribute(
      "href",
      "/tournaments/t1",
    );
    // UTC formatting keeps the stored day.
    expect(within(earnings).getAllByText(/Feb 15/).length).toBeGreaterThan(0);
    expect(within(earnings).getByText("Hole in One Award")).toBeInTheDocument();
    expect(within(earnings).getAllByText(/season award/i).length).toBeGreaterThan(0);
  });

  it("opens a player's breakdown from the podium", () => {
    render(<YearlyWinningsStandings year={2025} />);
    fireEvent.click(screen.getByRole("button", { name: /2nd, Bob/ }));
    expect(
      screen.getByRole("list", { name: /bob earnings/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
  });
});
