import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Tournaments from "@/pages/tournaments";

const navigateMock = vi.fn();
const addToastMock = vi.fn();

const templateTournament = {
  firestoreId: "template-1",
  title: "Fall Classic",
  description: "Bracket event",
  detailsMarkdown: "Details",
  players: 2,
  prizePool: 400,
  tee: "Blue",
  assignedTeeTimes: true,
  date: new Date("2026-08-14T00:00:00.000Z"),
  bracketRoundPayouts: [
    { round: 1, amount: 25 },
    { round: 2, amount: 60, runnerUpAmount: 15 },
  ],
};

vi.mock("@/hooks/usePageTracking", () => ({
  usePageTracking: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "admin-1" } }),
}));

vi.mock("@/components/membership/hooks", () => ({
  useAdminFlag: () => ({ isAdmin: true }),
}));

vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, ...props }: { icon: string }) => (
    <span {...props}>{icon}</span>
  ),
}));

vi.mock("@/components/tournament-list", () => ({
  TournamentList: ({
    tournaments,
  }: {
    tournaments: Array<{ title: string }>;
  }) => (
    <div data-testid="tournament-list">
      {tournaments.map((t) => t.title).join(", ")}
    </div>
  ),
}));

vi.mock("@/components/tournament-editor", () => ({
  TournamentEditor: ({ initialValues }: { initialValues?: unknown }) => (
    <div data-testid="tournament-editor">
      {JSON.stringify(initialValues ?? null)}
    </div>
  ),
}));

vi.mock("@/api/tournaments", () => ({
  onAllTournaments: (
    onNext: (snap: {
      docs: Array<{ data: typeof templateTournament }>;
    }) => void,
  ) => {
    onNext({ docs: [{ data: templateTournament }] });
    return () => {};
  },
  mapTournamentDoc: (doc: { data: typeof templateTournament }) => doc.data,
}));

vi.mock("@heroui/react", async (orig) => {
  const mod: typeof import("@heroui/react") = await orig();
  const ReactModule = await import("react");
  const SelectContext = ReactModule.createContext<{
    onChange?: (value: string | null) => void;
    isOpen: boolean;
    setIsOpen: (value: boolean) => void;
  } | null>(null);
  const RadioGroupContext = ReactModule.createContext<{
    value?: string;
    onChange?: (value: string) => void;
  } | null>(null);

  function MockButton({ children, onPress, ...props }: any) {
    return (
      <button type="button" onClick={() => onPress?.()} {...props}>
        {children}
      </button>
    );
  }

  function MockModalBackdrop({ children, isOpen }: any) {
    if (!isOpen) return null;
    return <div>{children}</div>;
  }

  function MockSelect({ children, onChange }: any) {
    const [isOpen, setIsOpen] = ReactModule.useState(false);
    return (
      <SelectContext.Provider value={{ onChange, isOpen, setIsOpen }}>
        <div>{children}</div>
      </SelectContext.Provider>
    );
  }

  function MockSelectTrigger({ children }: any) {
    const ctx = ReactModule.useContext(SelectContext);
    return (
      <button
        type="button"
        aria-haspopup="listbox"
        onClick={() => ctx?.setIsOpen(!ctx.isOpen)}
      >
        {children}
      </button>
    );
  }

  function MockSelectValue() {
    return null;
  }

  function MockSelectIndicator() {
    return null;
  }

  function MockSelectPopover({ children }: any) {
    const ctx = ReactModule.useContext(SelectContext);
    if (!ctx?.isOpen) return null;
    return <div role="listbox">{children}</div>;
  }

  (MockSelect as any).Trigger = MockSelectTrigger;
  (MockSelect as any).Value = MockSelectValue;
  (MockSelect as any).Indicator = MockSelectIndicator;
  (MockSelect as any).Popover = MockSelectPopover;

  function MockListBox({ children }: any) {
    return <div>{children}</div>;
  }

  function MockListBoxItem({ children, id }: any) {
    const ctx = ReactModule.useContext(SelectContext);
    return (
      <button
        type="button"
        role="option"
        onClick={() => {
          ctx?.onChange?.(String(id));
          ctx?.setIsOpen(false);
        }}
      >
        {children}
      </button>
    );
  }

  function MockListBoxItemIndicator() {
    return null;
  }

  (MockListBox as any).Item = MockListBoxItem;
  (MockListBox as any).ItemIndicator = MockListBoxItemIndicator;

  function MockRadioGroup({ children, value, onChange }: any) {
    return (
      <RadioGroupContext.Provider value={{ value, onChange }}>
        <div>{children}</div>
      </RadioGroupContext.Provider>
    );
  }

  function MockRadio({ children, value }: any) {
    const ctx = ReactModule.useContext(RadioGroupContext);
    return (
      <label>
        <input
          type="radio"
          checked={ctx?.value === value}
          onChange={() => ctx?.onChange?.(value)}
        />
        {children}
      </label>
    );
  }

  function MockRadioControl({ children }: any) {
    return <>{children}</>;
  }

  function MockRadioIndicator() {
    return null;
  }

  function MockRadioContent({ children }: any) {
    return <span>{children}</span>;
  }

  (MockRadio as any).Control = MockRadioControl;
  (MockRadio as any).Indicator = MockRadioIndicator;
  (MockRadio as any).Content = MockRadioContent;

  function MockLabel({ children }: any) {
    return <span>{children}</span>;
  }

  const MockModal = {
    Backdrop: MockModalBackdrop,
    Container: ({ children }: any) => <div>{children}</div>,
    Dialog: ({ children }: any) => <div>{children}</div>,
    Header: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Body: ({ children }: any) => <div>{children}</div>,
    Footer: ({ children }: any) => <div>{children}</div>,
  };

  return {
    ...mod,
    Button: MockButton,
    Label: MockLabel,
    ListBox: MockListBox,
    Modal: MockModal,
    Radio: MockRadio,
    RadioGroup: MockRadioGroup,
    Select: MockSelect,
  };
});

describe("Tournaments copy flow", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    addToastMock.mockReset();
  });

  it("copies bracket round payouts from the selected template", async () => {
    render(<Tournaments />);

    await waitFor(() => {
      expect(screen.getByTestId("tournament-list")).toHaveTextContent(
        /fall classic/i,
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: /create new tournament/i }),
    );
    fireEvent.click(screen.getByLabelText(/copy from previous/i));
    fireEvent.click(screen.getByRole("button", { name: "" }));
    fireEvent.click(
      screen.getByRole("option", { name: /fall classic \(2026\)/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByTestId("tournament-editor")).toHaveTextContent(
        '"bracketRoundPayouts":[{"round":1,"amount":25},{"round":2,"amount":60,"runnerUpAmount":15}]',
      );
    });
  });
});
