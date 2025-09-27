import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import TournamentRegister from "@/pages/tournament-register";

// Polyfill CSS.escape for HeroUI Select (react-aria)
if (!(globalThis as any).CSS) (globalThis as any).CSS = {};
if (!(globalThis as any).CSS.escape)
  (globalThis as any).CSS.escape = (s: string) => s;

// Mock router params & navigation
vi.mock("react-router-dom", () => ({
  useParams: () => ({ firestoreId: "tFull" }),
  useNavigate: () => vi.fn(),
}));

// Mock firebase config
vi.mock("@/config/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "fullUser" } },
}));

// Tournaments API mocks
vi.mock("@/api/tournaments", () => ({
  fetchTournament: vi.fn(async () => ({
    firestoreId: "tFull",
    title: "Full Member Test",
    date: new Date(),
    description: "Desc",
    players: 3,
    registrationOpen: true,
    completed: false,
    canceled: false,
    prizePool: 0,
    winners: [],
    tee: "Mixed",
  })),
  fetchUserRegistration: vi.fn(async () => null),
  upsertRegistration: vi.fn(async () => {}),
  deleteRegistration: vi.fn(async () => {}),
}));

// Auth provider: current user IS a full member
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "fullUser", displayName: "Captain Full" } }),
}));

// Users hook: include full + non-full
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "fullUser", displayName: "Captain Full", membershipType: "full" },
      { id: "hm1", displayName: "Handicap Member", membershipType: "handicap" },
      { id: "full2", displayName: "Second Full", membershipType: "full" },
      { id: "social", displayName: "Social Member", membershipType: "social" },
    ],
  }),
}));

// Silence toasts
vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  return { ...mod, addToast: vi.fn() };
});

describe("TournamentRegister teammate options (full members only)", () => {
  it("shows only full members in teammate Select options", async () => {
    render(<TournamentRegister />);

    // Wait for title
    await screen.findByText(/Register for Full Member Test/i);

    // Open first Select (Team Leader / You)
    const trigger = screen.getByRole("button", { name: /Team Leader/i });
    await act(async () => {
      trigger.click();
    });

    // Listbox should contain two occurrences for each visible option (hidden native <option> and visual item) - we assert at least one each while excluding non-full
    const captainAll = await screen.findAllByText("Captain Full");
    const secondAll = await screen.findAllByText("Second Full");
    expect(captainAll.length).toBeGreaterThan(0);
    expect(secondAll.length).toBeGreaterThan(0);

    // Ensure non-full members are NOT present as selectable options
    // Non full members should not appear as selectable options; they may not exist at all
    const handicap = screen.queryByText("Handicap Member");
    const social = screen.queryByText("Social Member");
    expect(handicap).toBeNull();
    expect(social).toBeNull();
  });
});
