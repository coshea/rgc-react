import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { ChampionshipYearGroup } from "@/components/championship-display";
import type { UnifiedChampionship } from "@/types/championship";

// Mock hooks used in components
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    userLoggedIn: false,
  }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map(),
    isLoading: false,
  }),
}));

// Mock iconify to avoid rendering issues in tests
vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => (
    <span data-testid="icon" data-icon={icon} />
  ),
}));

const mockChampionships: UnifiedChampionship[] = [
  {
    id: "1",
    year: 2024,
    championshipType: "pisano-cup",
    winnerNames: ["Winner 1"],
    isHistorical: false,
  },
  {
    id: "2",
    year: 2024,
    championshipType: "senior-club-champion",
    winnerNames: ["Winner 2"],
    isHistorical: false,
  },
  {
    id: "3",
    year: 2024,
    championshipType: "club-champion",
    winnerNames: ["Winner 3"],
    isHistorical: false,
  },
  {
    id: "4",
    year: 2024,
    championshipType: "presidents-cup",
    winnerNames: ["Winner 4"],
    isHistorical: false,
  },
  {
    id: "5",
    year: 2024,
    championshipType: "club-tee-champion",
    winnerNames: ["Winner 5"],
    isHistorical: false,
  },
];

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("ChampionshipYearGroup Grouping and Ordering", () => {
  afterEach(() => {
    cleanup();
  });

  it("groups championships into correct sections and orders them by TYPE_ORDER", () => {
    const fullMock = [
      ...mockChampionships,
      {
        id: "6",
        year: 2024,
        championshipType: "team-match-play",
        winnerNames: ["Winner 6"],
        isHistorical: false,
      },
      {
        id: "7",
        year: 2024,
        championshipType: "other",
        winnerNames: ["Winner 7"],
        isHistorical: false,
      },
    ];

    render(<ChampionshipYearGroup year={2024} championships={fullMock} />, {
      wrapper,
    });

    // Verify sections are present
    expect(screen.getByText("Club Championships")).toBeInTheDocument();
    expect(screen.getByText("Club Majors")).toBeInTheDocument();

    // The order should be:
    // Section: Club Championships
    // 1. Club Champion (id: 3)
    // 2. Club Tee Champion (id: 5)
    // 3. Senior Club Champion (id: 2)
    // Section: Club Majors
    // 4. President's Cup (id: 4)
    // 5. The Pisano Cup (id: 1)
    // 6. Team Match Play (id: 6)
    // 7. Other (id: 7)

    const titles = screen.getAllByRole("heading", { level: 3 });
    const titleTexts = titles.map((t) => t.textContent);

    expect(titleTexts).toEqual([
      "Club Champion",
      "Club Tee Champion",
      "Senior Club Champion",
      "President's Cup",
      "The Pisano Cup",
      "Team Match Play",
      "Other",
    ]);
  });

  it("renders only Club Championships section if no majors exist", () => {
    const clubOnly = mockChampionships.filter((c) =>
      ["club-champion", "club-tee-champion"].includes(c.championshipType),
    );

    render(<ChampionshipYearGroup year={2024} championships={clubOnly} />, {
      wrapper,
    });

    expect(screen.getByText("Club Championships")).toBeInTheDocument();
    expect(screen.queryByText("Club Majors")).not.toBeInTheDocument();
  });

  it("renders only Club Majors section if no club flights exist", () => {
    const majorsOnly = mockChampionships.filter((c) =>
      ["presidents-cup", "pisano-cup"].includes(c.championshipType),
    );

    render(<ChampionshipYearGroup year={2024} championships={majorsOnly} />, {
      wrapper,
    });

    expect(screen.queryByText("Club Championships")).not.toBeInTheDocument();
    expect(screen.getByText("Club Majors")).toBeInTheDocument();
  });

  it("sorts unknown types alphabetically at the end of Club Majors", () => {
    const mixed = [
      {
        id: "unknown-b",
        year: 2024,
        championshipType: "Z-Unknown",
        winnerNames: ["Winner"],
        isHistorical: false,
      },
      {
        id: "known",
        year: 2024,
        championshipType: "presidents-cup",
        winnerNames: ["Winner"],
        isHistorical: false,
      },
      {
        id: "unknown-a",
        year: 2024,
        championshipType: "A-Unknown",
        winnerNames: ["Winner"],
        isHistorical: false,
      },
    ];

    render(<ChampionshipYearGroup year={2024} championships={mixed} />, {
      wrapper,
    });

    const titles = screen.getAllByRole("heading", { level: 3 });
    const titleTexts = titles.map((t) => t.textContent);

    expect(titleTexts).toEqual(["President's Cup", "A-Unknown", "Z-Unknown"]);
  });
});
