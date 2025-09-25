import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import TournamentRegister from "@/pages/tournament-register";

// Mock router params
vi.mock("react-router-dom", () => ({
  useParams: () => ({ firestoreId: "t1" }),
  useNavigate: () => vi.fn(),
}));

// Mock firebase config
vi.mock("@/config/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "u2" } },
}));

// Firestore operations used in page
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    id: "t1",
    data: () => ({
      title: "Member Only Event",
      date: new Date(),
      description: "Desc",
      players: 2,
      registrationOpen: true,
    }),
  })),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
  addDoc: vi.fn(async () => ({})),
  setDoc: vi.fn(async () => ({})),
  deleteDoc: vi.fn(async () => ({})),
  serverTimestamp: vi.fn(() => new Date()),
}));

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

// Capture toasts to avoid errors (noop)
vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  return { ...mod, addToast: vi.fn() };
});

describe("TournamentRegister full member filter", () => {
  it("blocks non-full current user from registering", async () => {
    render(<TournamentRegister />);
    // Should show restriction message instead of form select
    expect(
      await screen.findByText(/Registration Restricted/i)
    ).toBeInTheDocument();
  });
});
