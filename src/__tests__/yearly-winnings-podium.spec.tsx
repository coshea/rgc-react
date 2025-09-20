import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";

// Minimal mocks for hooks used inside component
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true }),
}));

const SAMPLE_WINNINGS = [
  { userId: "u1", displayName: "Alice", total: 300, breakdown: [] },
  { userId: "u2", displayName: "Bob", total: 250, breakdown: [] },
  { userId: "u3", displayName: "Charlie", total: 150, breakdown: [] },
  { userId: "u4", displayName: "Dave", total: 120, breakdown: [] },
];

vi.mock("@/hooks/useYearlyWinnings", () => ({
  useYearlyWinnings: () => ({ winnings: SAMPLE_WINNINGS, isLoading: false }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

vi.mock("@/components/avatar", () => ({
  UserAvatar: ({ name }: any) => <div data-testid="avatar">{name}</div>,
}));

describe("YearlyWinningsStandings podium", () => {
  it("shows same top 3 after filtering out their names", () => {
    render(<YearlyWinningsStandings year={2025} />);

    // Assert initial podium contains Alice, Bob, Charlie
    const initialNames = ["Alice", "Bob", "Charlie"];
    initialNames.forEach((n) => {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    });

    // Apply a filter that matches only Dave
    const input = screen.getByPlaceholderText(/search player/i);
    fireEvent.change(input, { target: { value: "Dave" } });

    // Table should now only show Dave's row (rank cell + name) but podium remains
    expect(screen.getAllByText("Dave").length).toBeGreaterThan(0);

    // Podium players should still be visible even though filtered list excludes them
    initialNames.forEach((n) => {
      expect(screen.getAllByText(n).length).toBeGreaterThan(0);
    });
  });
});
