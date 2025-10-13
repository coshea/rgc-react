import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TournamentRegister from "@/pages/tournament-register";

// Mock Firebase Firestore functions
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  addDoc: vi.fn(async () => ({ id: "mock-id" })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  orderBy: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => new Date()),
  onSnapshot: vi.fn(() => () => {}),
}));

vi.mock("@/config/firebase", () => ({
  db: {
    _delegate: {
      app: { options: {} },
      settings: {},
    },
  },
  auth: { currentUser: { uid: "u1" } },
}));

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
vi.mock("@/api/tournaments", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...(original as any),
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
  };
});

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

// Silence toasts via provider
vi.mock("@/providers/toast", () => ({ addToast: vi.fn() }));

describe("TournamentRegister teammate options (full members only)", () => {
  it("shows only full members in teammate Select options", async () => {
    render(<TournamentRegister />);

    // Wait for title
    await screen.findByText(/Register for Full Member Test/i);

    // Open the Autocomplete (Team Leader / You) and type to reveal options
    // The component label used is 'Team Leader / You' via RegistrationEditor labels prop
    const combo = screen.getByRole("combobox", { name: /Team Leader \/ You/i });

    // Assert full members appear as options
    // Type to filter to 'Captain' and check option exists
    await act(async () => {
      fireEvent.change(combo, { target: { value: "Captain" } });
      fireEvent.keyDown(combo, { key: "ArrowDown" });
    });
    const captainOption = await screen.findByRole("option", {
      name: "Captain Full",
    });
    expect(captainOption).toBeInTheDocument();

    // Type to filter to 'Second' and check option exists
    await act(async () => {
      fireEvent.change(combo, { target: { value: "Second" } });
      fireEvent.keyDown(combo, { key: "ArrowDown" });
    });
    const secondOption = await screen.findByRole("option", {
      name: "Second Full",
    });
    expect(secondOption).toBeInTheDocument();

    // Ensure non-full members are NOT present as selectable options
    const handicapHidden = screen.queryByRole("option", {
      name: "Handicap Member",
    });
    const socialHidden = screen.queryByRole("option", {
      name: "Social Member",
    });
    expect(handicapHidden).toBeNull();
    expect(socialHidden).toBeNull();
  });
});
