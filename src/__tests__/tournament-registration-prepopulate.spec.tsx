import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import type { Tournament } from "@/types/tournament";
import { openRegistrationWindow } from "./tournament-utils";
import { findAutocompleteButton } from "./helpers/autocomplete";

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
  useAdminFlag: () => ({ isAdmin: true, loadingAdmin: false }),
  useBoardMemberFlag: () => ({ isBoardMember: false, loadingBoard: false }),
}));

// Toast capture
const addToastMock = vi.fn();
vi.mock("@/providers/toast", () => ({ addToast: (a: any) => addToastMock(a) }));

// Minimal heroui DatePicker mock to avoid rendering issues
vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    DatePicker: ({ label, value, onChange, granularity }: any) => (
      <div>
        <label>{label}</label>
        <input
          aria-label={label}
          type={granularity ? "datetime-local" : "date"}
          value={value?.toString?.() ?? value ?? ""}
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
  getAnalyticsInstance: () => null,
}));

// Mock firebase/firestore with controlled onSnapshot that yields a users snapshot
vi.mock("firebase/firestore", () => {
  return {
    collection: (...args: any[]) => ({ _path: args.slice(1).join("/") }),
    addDoc: vi.fn(async () => ({ id: "new123" })),
    updateDoc: vi.fn(async () => {}),
    doc: vi.fn((...args: any[]) => ({
      _isDoc: true,
      _path: args.slice(1).join("/"),
    })),
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
                membershipType: "full",
                lastPaidYear: new Date().getFullYear(),
              }),
            },
          ],
        });
      } else if (ref && ref._isDoc) {
        // Document snapshot (e.g. bracket doc) — return empty doc with exists() = false
        cb({ exists: () => false, data: () => undefined });
      } else {
        // Collection query (registrations) -> empty
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
    const { default: TournamentEditor } =
      await import("@/components/tournament-editor");

    const existing = {
      ...openRegistrationWindow(),
      title: "Test",
      description: "desc",
      players: 2,
      prizePool: 0,
      winnerGroups: [],
      date: new Date(),
      tee: "Blue",
      firestoreId: "t1",
    } satisfies Tournament;

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={existing}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Open the Registrations accordion so its contents render
    const regsToggle = await screen.findByRole("button", {
      name: /Registrations/i,
    });
    fireEvent.click(regsToggle);

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

    const trigger = findAutocompleteButton(/Team Leader/i);
    // Click trigger to open the Autocomplete popover, then type to filter and verify the option appears
    fireEvent.click(trigger);
    const searchInput = await screen.findByPlaceholderText("Search...");
    fireEvent.change(searchInput, { target: { value: "Admin" } });
    const option = await screen.findByRole("option", { name: /Admin User/i });
    expect(option).toBeInTheDocument();
  }, 20000);
});
