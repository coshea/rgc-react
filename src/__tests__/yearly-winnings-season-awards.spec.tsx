import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
            date: new Date("2025-02-15"),
            source: "tournament",
          },
          {
            tournamentId: "season-award:a1",
            title: "Hole in One Award",
            place: 0,
            amount: 50,
            date: new Date("2025-06-20"),
            source: "season-award",
          },
        ],
      },
    ],
  }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

// typed mock props for avatar; name is optional in production component
interface MockAvatarProps {
  name?: string;
}

vi.mock("@/components/avatar", () => ({
  UserAvatar: ({ name }: MockAvatarProps) => <div data-testid="avatar">{name}</div>,
}));

describe("YearlyWinningsStandings season awards", () => {
  it("includes season award totals and shows award breakdown", () => {
    render(<YearlyWinningsStandings year={2025} />);

    expect(screen.getByText("Awards $50")).toBeInTheDocument();

    const expandBtn = screen.getByLabelText(/expand winnings for alice/i);
    fireEvent.click(expandBtn);

    expect(screen.getByText(/1 award/i)).toBeInTheDocument();
    expect(screen.getByText("Award")).toBeInTheDocument();
  });
});
