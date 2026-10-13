import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { TournamentBreakdown } from "@/components/tournament-breakdown";
import type { Tournament } from "@/types/tournament";

// Mock auth to enable queries
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, user: { uid: "u-admin" } }),
}));

// Provide deterministic user profiles
vi.mock("@/api/users", () => ({
  getUsers: async () => [
    { id: "p1", displayName: "Alice" },
    { id: "p2", displayName: "Bob" },
    { id: "p3", displayName: "Cara" },
    { id: "p4", displayName: "Dan" },
    { id: "p5", displayName: "Eve" },
  ],
}));

// Mock useUsersMap (derives from getUsers normally)
vi.mock("@/hooks/useUsers", async () => {
  const users = [
    { id: "p1", displayName: "Alice" },
    { id: "p2", displayName: "Bob" },
    { id: "p3", displayName: "Cara" },
    { id: "p4", displayName: "Dan" },
    { id: "p5", displayName: "Eve" },
  ];
  const map = new Map(users.map((u) => [u.id, u] as const));
  return {
    useUsersMap: () => ({
      usersMap: map,
      isLoading: false,
      isFetching: false,
      count: users.length,
    }),
    useUsers: () => ({ users, isLoading: false }),
  };
});

// Dynamic tournament data for two events
// Tournament dates are date-only, stored as midnight UTC.
const janDate = new Date("2024-01-10T00:00:00Z");
const febDate = new Date("2024-02-12T00:00:00Z");

// Helper to build winnerGroups arrays
// Event 1: two-person team wins (positions 1), second place solo, third place solo
// Event 2: three distinct solo winners positions 1,2,3
const event1 = {
  firestoreId: "evt1",
  title: "Winter Classic",
  date: janDate,
  description: "",
  players: 0,
  completed: true,
  canceled: false,
  prizePool: 300,
  registrationOpen: false,
  tee: "Blue",
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
            { userId: "p1", displayName: "Alice" },
            { userId: "p2", displayName: "Bob" },
          ],
          prizeAmount: 100,
          score: "-5",
        },
        {
          place: 2,
          competitors: [{ userId: "p3", displayName: "Cara" }],
          prizeAmount: 60,
          score: "-2",
        },
        {
          place: 3,
          competitors: [{ userId: "p4", displayName: "Dan" }],
          prizeAmount: 40,
          score: "E",
        },
        {
          place: 3,
          competitors: [{ userId: "p5", displayName: "Eve" }],
          prizeAmount: 40,
          score: "E",
        },
      ],
    },
    {
      id: "ctp",
      label: "Closest to pin",
      type: "closestToPin",
      order: 2,
      winners: [
        {
          place: 1,
          holeNumber: 12,
          competitors: [{ userId: "p3", displayName: "Cara" }],
          prizeAmount: 25,
          score: "7' 9\"",
        },
      ],
    },
  ],
};
const event2 = {
  firestoreId: "evt2",
  title: "Frostbite Open",
  date: febDate,
  description: "",
  players: 0,
  completed: true,
  canceled: false,
  prizePool: 200,
  registrationOpen: false,
  tee: "White",
  winnerGroups: [
    {
      id: "overall",
      label: "Overall",
      type: "overall",
      order: 1,
      winners: [
        {
          place: 1,
          competitors: [{ userId: "p5", displayName: "Eve" }],
          prizeAmount: 80,
          score: "-3",
        },
        {
          place: 2,
          competitors: [{ userId: "p1", displayName: "Alice" }],
          prizeAmount: 50,
          score: "-1",
        },
        {
          place: 3,
          competitors: [{ userId: "p2", displayName: "Bob" }],
          prizeAmount: 30,
          score: "+1",
        },
      ],
    },
  ],
};

vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => ({
    tournaments: [
      event1 as unknown as Tournament,
      event2 as unknown as Tournament,
    ],
    isLoading: false,
  }),
}));

function renderComponent(initialEntry = "/money-list") {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TournamentBreakdown year={2024} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TournamentBreakdown (list and detail)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists events newest first with date, winner and total paid", () => {
    renderComponent();
    const list = screen.getByRole("list", {
      name: /tournaments with results/i,
    });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Frostbite Open");
    expect(rows[0]).toHaveTextContent("Feb 12");
    expect(rows[0]).toHaveTextContent("Won by Eve");
    expect(rows[0]).toHaveTextContent("$160");
    expect(rows[1]).toHaveTextContent("Winter Classic");
    // Date-only values must not slip to the previous day.
    expect(rows[1]).toHaveTextContent("Jan 10");
    expect(rows[1]).toHaveTextContent("Won by Alice and Bob");
    expect(screen.getByText(/2 tournaments, \$/)).toBeInTheDocument();
  });

  it("opens the newest event's results by default", () => {
    renderComponent();
    expect(
      screen.getByRole("heading", { level: 2, name: "Frostbite Open" }),
    ).toBeInTheDocument();
  });

  it("shows another event's results when it is picked", () => {
    renderComponent();
    fireEvent.click(screen.getByRole("button", { name: /winter classic/i }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Winter Classic" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Wednesday, January 10/)).toBeInTheDocument();
  });

  it("opens the event named in the URL", () => {
    renderComponent("/money-list?event=evt1");
    expect(
      screen.getByRole("heading", { level: 2, name: "Winter Classic" }),
    ).toBeInTheDocument();
  });

  it("writes ties as T3, in finishing order, and teams as each", () => {
    renderComponent("/money-list?event=evt1");
    const overall = screen
      .getByRole("heading", { level: 3, name: "Overall" })
      .closest("section")!;
    const items = within(overall).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("1");
    expect(items[0]).toHaveTextContent("Alice and Bob");
    expect(items[0]).toHaveTextContent("$100");
    expect(items[0]).toHaveTextContent("each");
    expect(items[1]).toHaveTextContent("2");
    expect(items[2]).toHaveTextContent("T3");
    expect(items[3]).toHaveTextContent("T3");
    expect(items[1]).not.toHaveTextContent("each");
  });

  it("marks under-par scores and labels closest-to-pin by hole", () => {
    renderComponent("/money-list?event=evt1");
    expect(screen.getAllByText("-5")[0]).toHaveClass("text-danger");
    expect(screen.getAllByText("E")[0]).not.toHaveClass("text-danger");
    const ctp = screen
      .getByRole("heading", { level: 3, name: "Closest to pin" })
      .closest("section")!;
    expect(within(ctp).getByText("No. 12")).toBeInTheDocument();
  });

  it("offers a jump chip per section and a way back to the list", () => {
    renderComponent("/money-list?event=evt1");
    const jump = screen.getByRole("navigation", { name: /jump to section/i });
    expect(
      within(jump).getByRole("button", { name: "Overall" }),
    ).toBeInTheDocument();
    expect(
      within(jump).getByRole("button", { name: "Closest to pin" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^tournaments$/i }));
    // Back to the default (newest) selection once the param is cleared.
    expect(
      screen.getByRole("heading", { level: 2, name: "Frostbite Open" }),
    ).toBeInTheDocument();
  });
});
