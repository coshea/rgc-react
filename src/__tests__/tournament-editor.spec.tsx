import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import TournamentEditor from "@/components/tournament-editor";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { openRegistrationWindow } from "./tournament-utils";

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
// Shared mutable ref so the @heroui/react MockTextField can pass a field id to
// the react-aria-components Label (which is imported separately in tournament-editor.tsx).
const fieldCtxRef = vi.hoisted(() => ({ current: "" }));

vi.mock("react-aria-components", async (orig) => {
  const mod: any = await orig();
  // Replace Label with a plain <label> that uses the shared field id for `htmlFor`.
  const MockRALabel = ({ children, ...rest }: any) => (
    <label htmlFor={fieldCtxRef.current || undefined} {...rest}>
      {children}
    </label>
  );
  return { ...mod, Label: MockRALabel };
});

vi.mock("@heroui/react", async (orig) => {
  const mod: any = await orig();
  const { useId, createContext, useContext } = await import("react");

  type FieldCtx = { id: string; value: string; onChange: (v: string) => void };
  const TextFieldCtx = createContext<FieldCtx | null>(null);

  function MockTextField({
    children,
    value,
    onChange,
    isInvalid,
    errorMessage,
    ...rest
  }: any) {
    const id = useId();
    fieldCtxRef.current = id;
    return (
      <TextFieldCtx.Provider
        value={{ id, value: value ?? "", onChange: onChange ?? (() => {}) }}
      >
        <div {...rest}>{children}</div>
        {isInvalid && errorMessage && <span role="alert">{errorMessage}</span>}
      </TextFieldCtx.Provider>
    );
  }

  function MockInput({
    label,
    value: valueProp,
    onChange: onChangeProp,
    onValueChange,
    type,
    min,
    max,
    isInvalid,
    errorMessage,
    ...rest
  }: any) {
    const ctx = useContext(TextFieldCtx);
    const id = ctx ? ctx.id : label ? `input-${label}` : undefined;
    const value = valueProp ?? ctx?.value ?? "";
    return (
      <div>
        {label && !ctx && <label htmlFor={id}>{label}</label>}
        <input
          id={id}
          type={type || "text"}
          value={value}
          min={min}
          max={max}
          aria-invalid={isInvalid || undefined}
          onChange={(e) => {
            if (ctx) ctx.onChange(e.target.value);
            if (onChangeProp) onChangeProp(e);
            if (onValueChange) onValueChange(e.target.value);
          }}
          {...rest}
        />
        {isInvalid && errorMessage && <span role="alert">{errorMessage}</span>}
      </div>
    );
  }

  function MockTextArea({
    label,
    value: valueProp,
    onValueChange,
    isInvalid,
    errorMessage,
    ...rest
  }: any) {
    const ctx = useContext(TextFieldCtx);
    const id = ctx ? ctx.id : label ? `textarea-${label}` : undefined;
    const value = valueProp ?? ctx?.value ?? "";
    return (
      <div>
        {label && !ctx && <label htmlFor={id}>{label}</label>}
        <textarea
          id={id}
          value={value}
          aria-invalid={isInvalid || undefined}
          onChange={(e) => {
            if (ctx) ctx.onChange(e.target.value);
            if (onValueChange) onValueChange(e.target.value);
          }}
          {...rest}
        />
        {isInvalid && errorMessage && <span role="alert">{errorMessage}</span>}
      </div>
    );
  }

  function MockDatePicker({
    label,
    value,
    onChange,
    granularity,
    children,
  }: any) {
    // In the compound pattern, label comes as a <Label> child rather than a prop.
    let labelText: string | undefined = label;
    if (!labelText && children) {
      const childArray = Array.isArray(children) ? children : [children];
      for (const child of childArray) {
        if (
          child &&
          typeof child === "object" &&
          typeof child.props?.children === "string"
        ) {
          labelText = child.props.children;
          break;
        }
      }
    }
    return (
      <div>
        {labelText && <label>{labelText}</label>}
        <input
          aria-label={labelText}
          type={granularity ? "datetime-local" : "date"}
          value={value?.toString?.() ?? value ?? ""}
          onChange={(e) => onChange?.(e.target.value || null)}
        />
      </div>
    );
  }

  const {
    useState: useStateMock,
    createContext: createContextMock,
    useContext: useContextMock,
  } = await import("react");
  type SelectCtx = {
    label?: string;
    onChange: (v: string) => void;
    isOpen: boolean;
    setOpen: (v: boolean) => void;
  };
  const SelectContext = createContextMock<SelectCtx | null>(null);

  function MockSelect({ children, onChange, value: _value, ...rest }: any) {
    const [isOpen, setOpen] = useStateMock(false);
    // Extract label text from children (e.g. <Label>Status</Label>)
    let labelText: string | undefined;
    const childArray = Array.isArray(children) ? children : [children];
    for (const child of childArray) {
      if (
        child &&
        typeof child === "object" &&
        typeof child.props?.children === "string"
      ) {
        labelText = child.props.children;
        break;
      }
    }
    return (
      <SelectContext.Provider
        value={{
          label: labelText,
          onChange: onChange ?? (() => {}),
          isOpen,
          setOpen,
        }}
      >
        <div {...rest}>{children}</div>
      </SelectContext.Provider>
    );
  }

  function MockSelectTrigger({ children }: any) {
    const ctx = useContextMock(SelectContext);
    return (
      <button
        type="button"
        aria-label={ctx?.label}
        onClick={() => ctx?.setOpen(!ctx.isOpen)}
      >
        {children}
      </button>
    );
  }

  function MockSelectValue() {
    return null;
  }
  function MockSelectIndicator() {
    return <span aria-hidden>▼</span>;
  }
  function MockSelectPopover({ children }: any) {
    const ctx = useContextMock(SelectContext);
    if (!ctx?.isOpen) return null;
    return <div role="listbox">{children}</div>;
  }

  MockSelect.Trigger = MockSelectTrigger;
  MockSelect.Value = MockSelectValue;
  MockSelect.Indicator = MockSelectIndicator;
  MockSelect.Popover = MockSelectPopover;

  function MockListBox({ children }: any) {
    return <>{children}</>;
  }
  function MockListBoxItem({ children, id, textValue }: any) {
    const ctx = useContextMock(SelectContext);
    return (
      <div
        role="option"
        onClick={() => {
          ctx?.onChange(id ?? textValue);
          ctx?.setOpen(false);
        }}
      >
        {children}
      </div>
    );
  }
  function MockListBoxItemIndicator() {
    return null;
  }
  MockListBox.Item = MockListBoxItem;
  MockListBox.ItemIndicator = MockListBoxItemIndicator;

  function MockCheckbox({ children, isSelected, onChange, id }: any) {
    return (
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={!!isSelected}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        {children}
      </label>
    );
  }
  function MockCheckboxControl({ children }: any) {
    return <>{children}</>;
  }
  function MockCheckboxIndicator() {
    return null;
  }
  function MockCheckboxContent({ children }: any) {
    return <>{children}</>;
  }
  MockCheckbox.Control = MockCheckboxControl;
  MockCheckbox.Indicator = MockCheckboxIndicator;
  MockCheckbox.Content = MockCheckboxContent;

  return {
    ...mod,
    TextField: MockTextField,
    Input: MockInput,
    TextArea: MockTextArea,
    DatePicker: MockDatePicker,
    Select: MockSelect,
    ListBox: MockListBox,
    Checkbox: MockCheckbox,
  };
});

// API-level mocks
const setBracketPublishedMock = vi.fn(async (..._args: any[]) => {});
vi.mock("@/api/tournaments", () => ({
  setBracketPublished: (...args: any[]) => setBracketPublishedMock(...args),
}));

// Firestore mocks
const addDocMock = vi.fn(async (..._args: any[]) => ({ id: "new123" }));
const updateDocMock = vi.fn(async (..._args: any[]) => {});

vi.mock("@/config/firebase", () => ({
  auth: { currentUser: { uid: "user1" } },
  db: {},
  getAnalyticsInstance: () => null,
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
  setBracketPublishedMock.mockClear();
});

describe("TournamentEditor - create mode", () => {
  it("prevents submit when required fields missing", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>,
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
      </QueryClientProvider>,
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
      ...openRegistrationWindow(),
      title: "Spring Open",
      description: "Fun event",
      players: 4,
      status: TournamentStatus.Upcoming,
      prizePool: 100,
      winnerGroups: [],
      date: new Date(),
      tee: "Blue",
      firestoreId: "abc123",
    };
    const onSave = vi.fn();
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={existing}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
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

  it("persists disabled registration-opening notifications", async () => {
    const existing: Tournament = {
      ...openRegistrationWindow(),
      title: "Spring Open",
      description: "Fun event",
      players: 4,
      status: TournamentStatus.Upcoming,
      prizePool: 100,
      winnerGroups: [],
      date: new Date(),
      tee: "Blue",
      firestoreId: "abc123",
      registrationOpeningNotificationEnabled: true,
    };
    const onSave = vi.fn();
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={existing}
          onSave={onSave}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByLabelText(/Send push notification when registration opens/i),
    );
    fireEvent.click(screen.getByRole("button", { name: /Update Tournament/i }));

    await waitFor(() => {
      expect(updateDocMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          registrationOpeningNotificationEnabled: false,
        }),
      );
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationOpeningNotificationEnabled: false,
        }),
      );
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
            },
          ],
        },
      ],
      date: new Date(),
      tee: "Red",
      firestoreId: "zzz",
    };
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor tournament={t} onSave={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>,
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
      </QueryClientProvider>,
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
      </QueryClientProvider>,
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
      /Enter number of players/i,
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
      </QueryClientProvider>,
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

describe("TournamentEditor - bracket publish/unpublish", () => {
  const baseTournament: Tournament = {
    ...openRegistrationWindow(),
    title: "Club Championship",
    description: "Annual event",
    players: 4,
    status: TournamentStatus.Upcoming,
    prizePool: 100,
    winnerGroups: [],
    date: new Date(),
    tee: "Blue",
    firestoreId: "abc123",
  };

  it("shows 'Publish' button when bracketPublished is false", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={{ ...baseTournament, bracketPublished: false }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: /^Publish$/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Published' button when bracketPublished is true", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={{ ...baseTournament, bracketPublished: true }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("button", { name: /^Published$/i }),
    ).toBeInTheDocument();
  });

  it("clicking Publish calls setBracketPublished(id, true) and shows success toast", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={{ ...baseTournament, bracketPublished: false }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));
    await waitFor(() => {
      expect(setBracketPublishedMock).toHaveBeenCalledWith("abc123", true);
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Bracket published",
          color: "success",
        }),
      );
    });
  });

  it("clicking Published (to unpublish) calls setBracketPublished(id, false) and shows success toast", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={{ ...baseTournament, bracketPublished: true }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Published$/i }));
    await waitFor(() => {
      expect(setBracketPublishedMock).toHaveBeenCalledWith("abc123", false);
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Bracket unpublished" }),
      );
    });
  });

  it("shows error toast when setBracketPublished throws", async () => {
    setBracketPublishedMock.mockRejectedValueOnce(new Error("Firestore error"));
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TournamentEditor
          tournament={{ ...baseTournament, bracketPublished: false }}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Publish$/i }));
    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Update failed",
          color: "danger",
        }),
      );
    });
  });
});
