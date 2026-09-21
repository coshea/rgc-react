import * as React from "react";
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

  type MockButtonProps = React.ComponentPropsWithoutRef<"button"> & {
    onPress?: () => void;
  };

  function MockButton({ children, onPress, ...props }: MockButtonProps) {
    return (
      <button type="button" onClick={() => onPress?.()} {...props}>
        {children}
      </button>
    );
  }

  type MockModalBackdropProps = {
    children?: React.ReactNode;
    isOpen?: boolean;
  };

  function MockModalBackdrop({ children, isOpen }: MockModalBackdropProps) {
    if (!isOpen) return null;
    return <div>{children}</div>;
  }

  type MockSelectProps = {
    children?: React.ReactNode;
    onChange?: (value: string | null) => void;
  };

  type MockSelectComponent = ((props: MockSelectProps) => React.JSX.Element) & {
    Trigger: typeof MockSelectTrigger;
    Value: typeof MockSelectValue;
    Indicator: typeof MockSelectIndicator;
    Popover: typeof MockSelectPopover;
  };

  function MockSelect({ children, onChange }: MockSelectProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
      <SelectContext.Provider value={{ onChange, isOpen, setIsOpen }}>
        <div>{children}</div>
      </SelectContext.Provider>
    );
  }

  function MockSelectTrigger({ children }: { children?: React.ReactNode }) {
    const ctx = React.useContext(SelectContext);
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

  function MockSelectPopover({ children }: { children?: React.ReactNode }) {
    const ctx = React.useContext(SelectContext);
    if (!ctx?.isOpen) return null;
    return <div role="listbox">{children}</div>;
  }

  const MockSelectWithStatics = Object.assign(MockSelect, {
    Trigger: MockSelectTrigger,
    Value: MockSelectValue,
    Indicator: MockSelectIndicator,
    Popover: MockSelectPopover,
  }) as MockSelectComponent;

  type MockListBoxProps = {
    children?: React.ReactNode;
  };

  type MockListBoxComponent = ((
    props: MockListBoxProps,
  ) => React.JSX.Element) & {
    Item: typeof MockListBoxItem;
    ItemIndicator: typeof MockListBoxItemIndicator;
  };

  function MockListBox({ children }: MockListBoxProps) {
    return <div>{children}</div>;
  }

  function MockListBoxItem({
    children,
    id,
  }: {
    children?: React.ReactNode;
    id?: string | number;
  }) {
    const ctx = React.useContext(SelectContext);
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

  const MockListBoxWithStatics = Object.assign(MockListBox, {
    Item: MockListBoxItem,
    ItemIndicator: MockListBoxItemIndicator,
  }) as MockListBoxComponent;

  type MockRadioGroupProps = {
    children?: React.ReactNode;
    value?: string;
    onChange?: (value: string) => void;
  };

  type MockRadioComponent = ((props: {
    children?: React.ReactNode;
    value?: string;
  }) => React.JSX.Element) & {
    Control: typeof MockRadioControl;
    Indicator: typeof MockRadioIndicator;
    Content: typeof MockRadioContent;
  };

  function MockRadioGroup({ children, value, onChange }: MockRadioGroupProps) {
    return (
      <RadioGroupContext.Provider value={{ value, onChange }}>
        <div>{children}</div>
      </RadioGroupContext.Provider>
    );
  }

  function MockRadio({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value?: string;
  }) {
    const ctx = React.useContext(RadioGroupContext);
    return (
      <label>
        <input
          type="radio"
          checked={ctx?.value === value}
          onChange={() => ctx?.onChange?.(value ?? "")}
        />
        {children}
      </label>
    );
  }

  function MockRadioControl({ children }: { children?: React.ReactNode }) {
    return <>{children}</>;
  }

  function MockRadioIndicator() {
    return null;
  }

  function MockRadioContent({ children }: { children?: React.ReactNode }) {
    return <span>{children}</span>;
  }

  const MockRadioWithStatics = Object.assign(MockRadio, {
    Control: MockRadioControl,
    Indicator: MockRadioIndicator,
    Content: MockRadioContent,
  }) as MockRadioComponent;

  function MockLabel({ children }: { children?: React.ReactNode }) {
    return <span>{children}</span>;
  }

  const MockModal = {
    Backdrop: MockModalBackdrop,
    Container: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Dialog: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Header: ({ children, ...props }: React.ComponentPropsWithoutRef<"div">) => (
      <div {...props}>{children}</div>
    ),
    Body: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Footer: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };

  return {
    ...mod,
    Button: MockButton,
    Label: MockLabel,
    ListBox: MockListBoxWithStatics,
    Modal: MockModal,
    Radio: MockRadioWithStatics,
    RadioGroup: MockRadioGroup,
    Select: MockSelectWithStatics,
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
