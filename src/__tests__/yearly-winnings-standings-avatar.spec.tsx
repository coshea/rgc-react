import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";

// Mock auth
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true }),
}));

// Mock winnings hook
vi.mock("@/hooks/useYearlyWinnings", () => ({
  useYearlyWinnings: () => ({
    isLoading: false,
    winnings: [
      { userId: "u1", displayName: "Alpha Player", total: 100, breakdown: [] },
    ],
  }),
}));

// Mock users map with profileURL so avatar should render an <img src>
vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map([
      [
        "u1",
        {
          id: "u1",
          displayName: "Alpha Player",
          profileURL: "https://example.com/avatar-alpha.png",
        },
      ],
    ]),
    isLoading: false,
  }),
}));

describe("YearlyWinningsStandings avatar rendering", () => {
  it("renders img avatar when profileURL available via usersMap", () => {
    render(<YearlyWinningsStandings year={2025} />);
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe(
      "https://example.com/avatar-alpha.png"
    );
    // Ensure at least one textual occurrence of the player name (can appear multiple times: podium + table)
    const nameEls = screen.getAllByText("Alpha Player");
    expect(nameEls.length).toBeGreaterThan(0);
  });
});
