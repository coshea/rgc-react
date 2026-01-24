import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TournamentRegister from "@/pages/tournament-register";

// Mock router params
vi.mock("react-router-dom", () => ({
  useParams: () => ({ firestoreId: "t1" }),
  useNavigate: () => vi.fn(),
}));

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

// Mock firebase config
vi.mock("@/config/firebase", () => ({
  db: {
    _delegate: {
      app: { options: {} },
      settings: {},
    },
  },
  auth: { currentUser: { uid: "u2" } },
  getAnalyticsInstance: () => null,
}));

// API mocks for tournaments
vi.mock("@/api/tournaments", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/api/tournaments")>();
  return {
    ...original,
    fetchTournament: vi.fn(async () => ({
      firestoreId: "t1",
      title: "Member Only Event",
      date: new Date(),
      description: "Desc",
      players: 2,
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

// Mock auth provider: current user (u2) is NOT a full member
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "u2", displayName: "Player Two" } }),
}));

// Mock users hook: includes a mix of full + handicap members
vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "u1", displayName: "Full Member 1", membershipType: "full" },
      { id: "u2", displayName: "Handicap Only", membershipType: "handicap" },
      { id: "u3", displayName: "Full Member 2", membershipType: "full" },
    ],
  }),
}));

// Capture toasts to avoid errors (noop) via provider
vi.mock("@/providers/toast", () => ({ addToast: vi.fn() }));

describe("TournamentRegister registration eligibility", () => {
  it("does not block non-full members from registering", async () => {
    render(<TournamentRegister />);
    // Should render the registration UI for any authenticated user
    expect(
      await screen.findByText(/Register for Member Only Event/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Registration Restricted/i)).toBeNull();
  });
});
