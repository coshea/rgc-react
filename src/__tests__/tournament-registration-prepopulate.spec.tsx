import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Start with a clean module registry so we can control mocks for this test file
vi.resetModules();

// Mock Auth provider so component thinks a user exists
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user1", displayName: "Admin User" } }),
}));

// Mock user profile hook to mark user as admin
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ userProfile: { admin: true } }),
}));

// Ensure admin gating inside TournamentEditor is true for test
vi.mock("@/components/membership/hooks", () => ({
  useDocAdminFlag: () => ({ isAdmin: true, loadingAdmin: false }),
}));

// Toast capture
const addToastMock = vi.fn();
vi.mock("@/providers/toast", () => ({ addToast: (a: any) => addToastMock(a) }));

// Minimal heroui DatePicker mock to avoid rendering issues
vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    DatePicker: ({ label, value, onChange }: any) => (
      <div>
        <label>{label}</label>
        <input
          aria-label={label}
          type="date"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value || null)}
        />
      </div>
    ),
  };
});

// Mock WinnerForm to avoid bringing in react-query hooks during this test
vi.mock("@/components/winner-form", () => ({
  WinnerForm: () => <div />,
}));

// Mock firebase config
vi.mock("@/config/firebase", () => ({
  auth: { currentUser: { uid: "user1" } },
  db: {},
}));

// Mock firebase/firestore with controlled onSnapshot that yields a users snapshot
vi.mock("firebase/firestore", () => {
  return {
    collection: (...args: any[]) => ({ _path: args.slice(1).join("/") }),
    addDoc: vi.fn(async () => ({ id: "new123" })),
    updateDoc: vi.fn(async () => {}),
    doc: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    query: (col: any, ..._args: any[]) => ({ _path: col._path + "/query" }),
    serverTimestamp: vi.fn(() => new Date()),
    onSnapshot: (ref: any, cb: any) => {
      // If the collection path includes 'users' return a snapshot containing the current user
      if (ref && ref._path && ref._path.includes("users")) {
        cb({
          docs: [
            {
              id: "user1",
              data: () => ({
                displayName: "Admin User",
                email: "admin@example.com",
              }),
            },
          ],
        });
      } else {
        // registrations -> empty
        cb({ docs: [] });
      }
      return () => {};
    },
  };
});

// Use real RegistrationEditor for this test so we can observe the Select contents
// Do not mock '@/components/registration-editor'

describe("TournamentEditor - Add Registration prepopulate", () => {
  it("pre-populates leader select with current user when opening Add Registration", async () => {
    // Import component after mocks are set up
    const { default: TournamentEditor } = await import(
      "@/components/tournament-editor"
    );

    const existing = {
      title: "Test",
      description: "desc",
      players: 2,
      completed: false,
      canceled: false,
      prizePool: 0,
      winners: [],
      registrationOpen: true,
      date: new Date(),
      tee: "Blue",
      firestoreId: "t1",
    } as any;

    render(
      <TournamentEditor
        tournament={existing}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Wait for the Add Registration button to appear (it requires isAdmin)
    const addBtn = await screen.findByRole("button", {
      name: /Add Registration/i,
    });
    fireEvent.click(addBtn);

    // The admin flow no longer auto-creates the first slot. Click 'Add Teammate' to create the first slot,
    // then open the Team Leader select and assert the Admin User option exists.
    const addTeammate = await screen.findByRole("button", {
      name: /Add Teammate/i,
    });
    fireEvent.click(addTeammate);

    const trigger = await screen.findByRole("button", { name: /Team Leader/i });
    // Open the select popover
    fireEvent.click(trigger);
    // The option should now be present in the options list
    const options = await screen.findAllByRole("option", {
      name: /Admin User/i,
    });
    expect(options.length).toBeGreaterThan(0);
  }, 20000);
});
