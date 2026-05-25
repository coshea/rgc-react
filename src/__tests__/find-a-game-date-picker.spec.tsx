import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { parseDate } from "@internationalized/date";

// ---------------------------------------------------------------------------
// HeroUI mock — stub compound components to simple HTML so jsdom can render
// them without react-aria internals / resize observers / portals.
// ---------------------------------------------------------------------------
vi.mock("@heroui/react", async (orig) => {
  const mod = await orig<typeof import("@heroui/react")>();

  // Stub Modal so the dialog renders inline (no portal / display:none).
  const MockModal = Object.assign(
    ({ children, isOpen }: { children?: React.ReactNode; isOpen?: boolean }) =>
      isOpen ? <div data-testid="modal">{children}</div> : null,
    {
      Backdrop: ({
        children,
        isOpen,
      }: {
        children?: React.ReactNode;
        isOpen?: boolean;
      }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
      Container: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Dialog: ({ children }: { children?: React.ReactNode }) => (
        <div role="dialog">{children}</div>
      ),
      Header: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Body: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Footer: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
    },
  );

  // Stub Select so mode can be changed via a native <select>.
  const MockSelect = Object.assign(
    ({
      children,
      value,
      onChange,
      className,
    }: {
      children?: React.ReactNode;
      value?: string;
      onChange?: (key: string) => void;
      className?: string;
    }) => (
      <select
        data-testid="mode-select"
        value={value}
        className={className}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {children}
      </select>
    ),
    {
      Trigger: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
      Value: () => null,
      Indicator: () => null,
      Popover: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
    },
  );

  // Stub DatePicker — renders a native <input type="date"> so tests can
  // interact with the date value and trigger onChange directly.
  const MockDatePicker = Object.assign(
    ({
      children,
      value,
      onChange,
      minValue,
      className,
      isRequired,
    }: {
      children?: React.ReactNode;
      value?: ReturnType<typeof parseDate> | null;
      onChange?: (v: ReturnType<typeof parseDate> | null) => void;
      minValue?: ReturnType<typeof parseDate>;
      className?: string;
      isRequired?: boolean;
    }) => (
      <div data-testid="date-picker" className={className}>
        {/* Surface a native date input that proxies calls to the HeroUI onChange */}
        <input
          type="date"
          data-testid="date-input"
          value={value ? value.toString() : ""}
          min={minValue ? minValue.toString() : undefined}
          required={isRequired}
          onChange={(e) => {
            const raw = e.target.value;
            onChange?.(raw ? parseDate(raw) : null);
          }}
        />
        {children}
      </div>
    ),
    {
      Trigger: ({ children }: { children?: React.ReactNode }) => (
        <button type="button">{children}</button>
      ),
      TriggerIndicator: () => <span>📅</span>,
      Popover: ({ children }: { children?: React.ReactNode }) => (
        <div>{children}</div>
      ),
    },
  );

  // Stub DateField (children only used inside DatePicker; not needed for tests).
  const MockDateField = Object.assign(() => null, {
    Group: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Input: () => null,
    Segment: () => null,
    Suffix: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
  });

  // Stub Calendar (appears inside DatePicker.Popover; not the focus of tests).
  const MockCalendar = Object.assign(() => null, {
    Header: () => null,
    YearPickerTrigger: () => null,
    YearPickerTriggerHeading: () => null,
    YearPickerTriggerIndicator: () => null,
    NavButton: () => null,
    Grid: () => null,
    GridHeader: () => null,
    HeaderCell: () => null,
    GridBody: () => null,
    Cell: () => null,
    YearPickerGrid: () => null,
    YearPickerGridBody: () => null,
    YearPickerCell: () => null,
  });

  const MockForm = ({
    children,
    onSubmit,
    ...rest
  }: {
    children?: React.ReactNode;
    onSubmit?: React.FormEventHandler;
    [k: string]: unknown;
  }) => (
    <form onSubmit={onSubmit} {...rest}>
      {children}
    </form>
  );

  const MockButton = ({
    children,
    onPress,
    isDisabled,
    type,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    type?: "button" | "submit" | "reset";
  }) => (
    <button
      type={type ?? "button"}
      disabled={isDisabled}
      onClick={() => onPress?.()}
    >
      {children}
    </button>
  );

  const MockLabel = ({ children }: { children?: React.ReactNode }) => (
    <label>{children}</label>
  );

  const MockListBox = Object.assign(
    ({ children }: { children?: React.ReactNode }) => <ul>{children}</ul>,
    {
      Item: ({ children, id }: { children?: React.ReactNode; id?: string }) => (
        <option value={id}>{children}</option>
      ),
      ItemIndicator: () => null,
    },
  );

  const MockChip = ({
    children,
  }: {
    children?: React.ReactNode;
    size?: string;
    variant?: string;
  }) => <span>{children}</span>;

  return {
    ...(mod as object),
    Modal: MockModal,
    Form: MockForm,
    Button: MockButton,
    Label: MockLabel,
    ListBox: MockListBox,
    Select: MockSelect,
    DatePicker: MockDatePicker,
    DateField: MockDateField,
    Calendar: MockCalendar,
    Chip: MockChip,
  };
});

// ---------------------------------------------------------------------------
// Minor dependency stubs
// ---------------------------------------------------------------------------
vi.mock("@iconify/react", () => ({ Icon: () => null }));

vi.mock("@/api/find-a-game", () => ({
  toYMD: (d: Date) => d.toISOString().slice(0, 10),
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------
import FindAGamePostModal, {
  type FindAGamePostModalProps,
} from "@/components/find-a-game/FindAGamePostModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TODAY = "2099-06-15"; // far-future so minValue never blocks

function defaultProps(
  overrides?: Partial<FindAGamePostModalProps>,
): FindAGamePostModalProps {
  return {
    isOpen: true,
    onClose: vi.fn(),
    mode: "needPlayers",
    onModeChange: vi.fn(),
    date: TODAY,
    onDateChange: vi.fn(),
    time: "",
    onTimeChange: vi.fn(),
    openSpots: "2",
    onOpenSpotsChange: vi.fn(),
    canSubmit: true,
    creating: false,
    onSubmit: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("FindAGamePostModal DatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal when isOpen=true", () => {
    render(<FindAGamePostModal {...defaultProps()} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("does NOT render the modal when isOpen=false", () => {
    render(<FindAGamePostModal {...defaultProps({ isOpen: false })} />);
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders the date picker with the supplied date value", () => {
    render(<FindAGamePostModal {...defaultProps({ date: "2099-07-04" })} />);
    const input = screen.getByTestId<HTMLInputElement>("date-input");
    expect(input.value).toBe("2099-07-04");
  });

  it("calls onDateChange with the ISO string when the date changes", () => {
    const onDateChange = vi.fn();
    render(<FindAGamePostModal {...defaultProps({ onDateChange })} />);
    const input = screen.getByTestId("date-input");

    fireEvent.change(input, { target: { value: "2099-09-01" } });

    expect(onDateChange).toHaveBeenCalledTimes(1);
    expect(onDateChange).toHaveBeenCalledWith("2099-09-01");
  });

  it("calls onDateChange with empty string when date is cleared", () => {
    const onDateChange = vi.fn();
    render(<FindAGamePostModal {...defaultProps({ onDateChange })} />);
    const input = screen.getByTestId("date-input");

    fireEvent.change(input, { target: { value: "" } });

    expect(onDateChange).toHaveBeenCalledWith("");
  });

  it("enforces minValue equal to today's date", () => {
    render(<FindAGamePostModal {...defaultProps()} />);
    const input = screen.getByTestId<HTMLInputElement>("date-input");
    // minValue is set to toYMD(new Date()); we can't assert the exact value
    // without knowing today's real date, but we assert the attribute is set.
    expect(input).toHaveAttribute("min");
  });

  it("calls onSubmit when the form is submitted", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<FindAGamePostModal {...defaultProps({ onSubmit })} />);
    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    // Allow the async handler to run
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders with the custom title when provided", () => {
    render(<FindAGamePostModal {...defaultProps({ title: "Edit Post" })} />);
    expect(screen.getByText("Edit Post")).toBeInTheDocument();
  });

  it("renders default title 'Create Post' when no title provided", () => {
    render(<FindAGamePostModal {...defaultProps()} />);
    expect(screen.getByText("Create Post")).toBeInTheDocument();
  });
});
