import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";

// Minimal mocks for hooks used inside component
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, user: { uid: "u4" } }),
}));

const SAMPLE_WINNINGS = [
  { userId: "u1", displayName: "Alice", total: 300, breakdown: [] },
  { userId: "u2", displayName: "Bob", total: 250, breakdown: [] },
  { userId: "u3", displayName: "Charlie", total: 150, breakdown: [] },
  { userId: "u4", displayName: "Dave", total: 150, breakdown: [] },
];

vi.mock("@/hooks/useYearlyWinnings", () => ({
  useYearlyWinnings: () => ({ winnings: SAMPLE_WINNINGS, isLoading: false }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

vi.mock("@/components/avatar", () => ({
  UserAvatar: ({ name }: { name?: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

const podium = () => screen.getByRole("region", { name: /top three/i });
const standings = () => screen.getByRole("list", { name: /^standings$/i });

describe("YearlyWinningsStandings podium", () => {
  it("shows the top three with trophies and the lead", () => {
    render(<YearlyWinningsStandings year={2025} />);
    const p = podium();
    expect(
      within(p).getByRole("button", { name: /1st, Alice, \$300/ }),
    ).toBeInTheDocument();
    expect(
      within(p).getByRole("button", { name: /2nd, Bob, \$250/ }),
    ).toBeInTheDocument();
    expect(within(p).getByTestId("trophy-1")).toBeInTheDocument();
    expect(within(p).getByTestId("trophy-2")).toBeInTheDocument();
    expect(within(p).getByTestId("trophy-3")).toBeInTheDocument();
    expect(within(p).getByText("Alice leads by $50.")).toBeInTheDocument();
  });

  it("keeps the same top 3 after filtering out their names", () => {
    render(<YearlyWinningsStandings year={2025} />);
    fireEvent.change(screen.getByPlaceholderText(/find a player/i), {
      target: { value: "Dave" },
    });
    expect(within(standings()).getAllByRole("listitem")).toHaveLength(1);
    ["Alice", "Bob", "Charlie"].forEach((n) => {
      expect(within(podium()).getAllByText(n).length).toBeGreaterThan(0);
    });
  });

  it("writes tied ranks as T3 and marks your own row", () => {
    render(<YearlyWinningsStandings year={2025} />);
    const rows = within(standings()).getAllByRole("listitem");
    expect(rows[2]).toHaveTextContent("T3");
    expect(rows[3]).toHaveTextContent("T3");
    expect(within(rows[3]).getByText("You")).toBeInTheDocument();
    expect(within(rows[0]).queryByText("You")).not.toBeInTheDocument();
  });

  it("explains an empty search", () => {
    render(<YearlyWinningsStandings year={2025} />);
    fireEvent.change(screen.getByPlaceholderText(/find a player/i), {
      target: { value: "Zed" },
    });
    expect(screen.getByText(/No players match “Zed”/)).toBeInTheDocument();
  });
});
