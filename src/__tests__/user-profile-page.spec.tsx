import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserProfilePage from "@/pages/user-profile";

const authState = { user: { uid: "viewer" } };
const registrationsState: {
  data: unknown[];
  isLoading: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
} = { data: [], isLoading: false, isError: false, refetch: vi.fn() };

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/usePageTracking", () => ({ usePageTracking: () => {} }));
vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({ usersMap: new Map() }),
}));

vi.mock("@/hooks/useUserById", () => ({
  useUserById: () => ({
    isLoading: false,
    user: {
      id: "pat",
      displayName: "Pat Morgan",
      email: "pat@example.com",
      phone: "2035550142",
      membershipType: "full",
      boardMember: true,
      role: "Treasurer",
    },
  }),
}));

vi.mock("@/hooks/useUserTournaments", () => ({
  useUserChampionships: () => ({
    isLoading: false,
    data: [
      {
        id: "c1",
        tournamentName: "club-champion",
        championshipType: "club-champion",
        year: 2024,
        placement: "champion",
        date: "2024-06-15",
      },
      {
        id: "c2",
        tournamentName: "pisano-cup",
        championshipType: "pisano-cup",
        year: 2025,
        placement: "runner-up",
        date: "2025-06-15",
      },
    ],
  }),
  useUserTournamentWins: () => ({
    isLoading: false,
    data: [
      {
        id: "w0",
        tournamentName: "Old Classic",
        year: 2001,
        date: "2001-05-01T00:00:00.000Z",
        prize: 50,
        position: 2,
        isMajor: false,
        placement: "winner",
        source: "tournament",
      },
      {
        id: "w1",
        tournamentName: "Fall Scramble",
        year: new Date().getFullYear(),
        date: `${new Date().getFullYear()}-01-12T00:00:00.000Z`,
        prize: 120,
        position: 1,
        isMajor: false,
        placement: "winner",
        source: "tournament",
      },
    ],
  }),
  useUserWinnings: () => ({
    isLoading: false,
    data: { lifetime: 1240, yearly: [{ year: 2026, amount: 310 }] },
  }),
  useUserRegistrations: () => registrationsState,
}));

function renderProfile(path = "/profile/pat") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profile/:userId" element={<UserProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.user = { uid: "viewer" };
  registrationsState.isError = false;
  registrationsState.refetch = vi.fn();
});

describe("UserProfilePage", () => {
  it("shows the summary, stats and overview", () => {
    renderProfile();
    expect(
      screen.getByRole("heading", { level: 1, name: "Pat Morgan" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$1,240")).toBeInTheDocument();
    expect(screen.getByText("Lifetime winnings")).toBeInTheDocument();
    // Only champion placements count toward the Championships stat.
    const stats = screen.getByRole("region", { name: "Stats" });
    expect(stats).toHaveTextContent("1Championships");
    expect(screen.getByText("Club Champion")).toBeInTheDocument();
    // Overview lists this year's wins only.
    expect(screen.getByText("Fall Scramble")).toBeInTheDocument();
    expect(screen.queryByText("Old Classic")).not.toBeInTheDocument();
  });

  it("hides edit actions on someone else's profile", () => {
    renderProfile();
    expect(
      screen.queryByRole("link", { name: /Edit profile/ }),
    ).not.toBeInTheDocument();
  });

  it("links to the edit page on your own profile", () => {
    authState.user = { uid: "pat" };
    renderProfile();
    expect(screen.getByRole("link", { name: /Edit profile/ })).toHaveAttribute(
      "href",
      "/profile/edit",
    );
  });

  it("opens the tab named in the URL", () => {
    renderProfile("/profile/pat?tab=wins");
    expect(
      screen.getByRole("region", { name: "2001 wins" }),
    ).toBeInTheDocument();
  });

  it("offers a retry when registrations fail to load", () => {
    registrationsState.isError = true;
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(registrationsState.refetch).toHaveBeenCalled();
  });
});
