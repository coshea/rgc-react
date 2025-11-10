import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import TournamentEditor from "@/components/tournament-editor";
import { Tournament, TournamentStatus } from "@/types/tournament";

// Mock Auth provider hook so component thinks a user (and optionally admin) exists
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user1", displayName: "Admin User" } }),
}));

// Mock user profile hook to mark user as admin
vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({ userProfile: { admin: true } }),
}));

// Capture toast calls
const addToastMock = vi.fn();
vi.mock("@/providers/toast", () => ({
  addToast: (args: any) => addToastMock(args),
}));
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

// Firestore mocks
const addDocMock = vi.fn(async (..._args: any[]) => ({ id: "new123" }));
const updateDocMock = vi.fn(async (..._args: any[]) => {});

vi.mock("@/config/firebase", () => ({
  auth: { currentUser: { uid: "user1" } },
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  addDoc: (...args: any[]) => addDocMock(...args),
  updateDoc: (...args: any[]) => updateDocMock(...args),
  doc: vi.fn(() => ({})),
  deleteField: vi.fn(() => ({ __type: "deleteField" })),
  parseDate: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

// Minimal markdown editor mock to avoid complexity
vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      aria-label="Details Markdown"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// WinnerForm mock (behavior internal not needed for basic tests)
vi.mock("@/components/winner-form", () => ({
  WinnerForm: () => <div data-testid="winner-form" />,
}));

// Registrations list & editor mocks
vi.mock("@/components/registrations-list", () => ({
  __esModule: true,
  default: () => <div data-testid="registrations-list" />,
}));
vi.mock("@/components/registration-editor", () => ({
  __esModule: true,
  default: () => <div data-testid="registration-editor" />,
}));

// Utility to fill core fields
function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/Tournament Title/i), {
    target: { value: "Club Championship" },
  });
  fireEvent.change(screen.getByLabelText(/Description/i), {
    target: { value: "Annual event" },
  });
  // DatePicker from heroui may not expose direct input; we can skip if optional in test environment.
}

beforeEach(() => {
  addToastMock.mockClear();
  addDocMock.mockClear();
  updateDocMock.mockClear();
});

describe("TournamentEditor - create mode", () => {
  it("prevents submit when required fields missing", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Create Tournament/i }));
    await waitFor(() => expect(addDocMock).not.toHaveBeenCalled());
  });

  it("submits when required fields provided", async () => {
    const onSave = vi.fn();
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor onSave={onSave} onCancel={vi.fn()} />
      </QueryClientProvider>
    );
    fillRequiredFields();
    // set a date
    const dateInput = screen.getByLabelText(/Tournament Date/i);
    fireEvent.change(dateInput, { target: { value: "2025-01-01" } });
    // Provide date by mocking setDate via selecting DatePicker - since DatePicker is complex, simulate by directly setting internal state using a hidden field approach.
    // Simpler: monkey patch setDate by interacting with date picker label if available. If not present, we relax date requirement by mocking validation (could mock parse or date state).
    // For reliability: temporarily remove date requirement by mocking validateForm? Instead, set a hidden implementation detail: direct assignment through prototype not feasible.
    // We'll mock parseDate import path used in component to ensure date initialises; easier is to bypass date validation by providing a date value manually through React state.
    // Approach: Use testing hack - override Date.now and rely on component default if not set. We'll instead set the date state by finding DatePicker label if rendered.
    // If Date validation blocks, test can assert validation message rather than full submit.

    // Try clicking submit
    fireEvent.click(screen.getByRole("button", { name: /Create Tournament/i }));

    await waitFor(() => {
      expect(addDocMock).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
    });
  });
});

describe("TournamentEditor - edit mode", () => {
  it("shows Edit Tournament header and updates via updateDoc", async () => {
    const existing: Tournament = {
      title: "Spring Open",
      description: "Fun event",
      players: 4,
      status: TournamentStatus.Open,
      prizePool: 100,
      winnerGroups: [],
      date: new Date(),
      tee: "Blue",
      firestoreId: "abc123",
    } as any;
    const onSave = vi.fn();
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={existing}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>
    );
    expect(screen.getByText(/Edit Tournament/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Tournament Title/i), {
      target: { value: "Spring Open Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Update Tournament/i }));

    await waitFor(() => {
      expect(updateDocMock).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
    });
  });
});

// Prize pool validation scenario

describe("TournamentEditor - winners validation", () => {
  it("flags prize pool exceeded when completed with winners", async () => {
    // Provide a tournament that is marked completed with winners > prize pool logic triggered internally: we rely on validateForm.
    const t: Tournament = {
      title: "Event",
      description: "Desc",
      players: 1,
      status: TournamentStatus.Completed,
      prizePool: 10,
      winnerGroups: [
        {
          id: "g1",
          label: "Overall",
          type: "overall",
          order: 0,
          winners: [
            {
              place: 1,
              prizeAmount: 20,
              competitors: [{ userId: "u1", displayName: "User 1" }],
            } as any,
          ],
        } as any,
      ],
      date: new Date(),
      tee: "Red",
      firestoreId: "zzz",
    } as any;
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor tournament={t} onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>
    );
    // Click update should trigger validation
    fireEvent.click(screen.getByRole("button", { name: /Update Tournament/i }));
    await waitFor(() => {
      expect(screen.getByText(/exceeds prize pool/i)).toBeTruthy();
      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });
});

describe("TournamentEditor - edge cases", () => {
  it("prevents submission when prize pool negative", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>
    );
    // fill core fields
    fireEvent.change(screen.getByLabelText(/Tournament Title/i), {
      target: { value: "Test Neg Prize" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Desc" },
    });
    fireEvent.change(screen.getByLabelText(/Tournament Date/i), {
      target: { value: "2025-02-02" },
    });
    // NumberInput renders internal input without accessible label sometimes; use placeholder
    const prize = screen.getByPlaceholderText(/Enter prize amount/i);
    fireEvent.change(prize, { target: { value: -5 } });
    fireEvent.click(screen.getByRole("button", { name: /Create Tournament/i }));
    await waitFor(() => {
      expect(addDocMock).not.toHaveBeenCalled();
    });
  });

  it("prevents submission when players < 1", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/Tournament Title/i), {
      target: { value: "Test Players" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Desc" },
    });
    fireEvent.change(screen.getByLabelText(/Tournament Date/i), {
      target: { value: "2025-02-03" },
    });
    // players input: fallback to placeholder
    const playersInput = screen.getByPlaceholderText(
      /Enter number of players/i
    );
    fireEvent.change(playersInput, { target: { value: 0 } });
    fireEvent.click(screen.getByRole("button", { name: /Create Tournament/i }));
    await waitFor(() => {
      expect(addDocMock).not.toHaveBeenCalled();
    });
  });

  it("allows submission when canceled and completed toggled (no winners)", async () => {
    const onSave = vi.fn();
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor onSave={onSave} onCancel={vi.fn()} />
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText(/Tournament Title/i), {
      target: { value: "Dual State" },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: "Desc" },
    });
    fireEvent.change(screen.getByLabelText(/Tournament Date/i), {
      target: { value: "2025-02-04" },
    });
    // set status via Select dropdown (enum model replaces legacy checkboxes)
    // open the Status select by interacting with the combobox labeled "Status"
    const statusTrigger = screen.getByRole("button", { name: /Status/i });
    fireEvent.click(statusTrigger);
    // choose Canceled from the menu
    const cancelOption = await screen.findByText(/Tournament Canceled/i);
    fireEvent.click(cancelOption);
    fireEvent.click(screen.getByRole("button", { name: /Create Tournament/i }));
    await waitFor(() => {
      expect(addDocMock).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
    });
  });
});
