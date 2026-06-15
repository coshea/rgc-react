import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SeasonAwardsManager } from "@/components/season-awards-manager";
import { SeasonAwardType } from "@/types/seasonAwards";

const upsertSeasonAwardMock = vi.fn();
const deleteSeasonAwardMock = vi.fn();
const onSeasonAwardsByYearMock = vi.fn();

vi.mock("@/api/seasonAwards", () => ({
  upsertSeasonAward: (...args: unknown[]) => upsertSeasonAwardMock(...args),
  deleteSeasonAward: (...args: unknown[]) => deleteSeasonAwardMock(...args),
  onSeasonAwardsByYear: (...args: unknown[]) =>
    onSeasonAwardsByYearMock(...args),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map([
      [
        "u1",
        {
          id: "u1",
          displayName: "Alice Member",
          email: "alice@example.com",
        },
      ],
    ]),
  }),
}));

// HeroUI v3 Input renders <input label="..."> without aria-label.
// Provide accessible shims so getByLabelText works in tests.
vi.mock("@heroui/react", async (importOriginal) => {
  const mod: any = await importOriginal();
  const React = await import("react");
  const TFCtx = React.createContext<{
    value?: string;
    onChange?: (v: string) => void;
  } | null>(null);
  return {
    ...mod,
    TextField: ({ children, value, onChange }: any) =>
      React.createElement(
        TFCtx.Provider,
        { value: { value, onChange } },
        children,
      ),
    FieldError: ({ children }: any) => <span>{children}</span>,
    Input: ({
      label,
      value: valueProp,
      onChange: onChangeProp,
      onValueChange,
      type,
      min,
      max,
      isInvalid: _isInvalid,
      errorMessage: _errorMessage,
      ...rest
    }: any) => {
      const ctx = React.useContext(TFCtx);
      const value = ctx?.value ?? valueProp ?? "";
      const handleChange = (e: any) => {
        if (ctx?.onChange) ctx.onChange(e.target.value);
        if (onChangeProp) onChangeProp(e);
        if (onValueChange) onValueChange(e.target.value);
      };
      return (
        <div>
          {label && <label htmlFor={`input-${label}`}>{label}</label>}
          <input
            id={`input-${label}`}
            aria-label={label}
            type={type || "text"}
            value={value}
            min={min}
            max={max}
            onChange={handleChange}
            {...rest}
          />
        </div>
      );
    },
  };
});

// provide a lightweight typed mock for UserSelect used by tests
interface UserSelectMockProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

vi.mock("@/components/UserSelect", () => ({
  __esModule: true,
  default: ({ value, onChange, label }: UserSelectMockProps) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select member</option>
        <option value="u1">Alice Member</option>
      </select>
    </label>
  ),
}));

describe("SeasonAwardsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSeasonAwardsByYearMock.mockImplementation(
      (_year: number, next: (items: unknown[]) => void) => {
        next([]);
        return () => {};
      },
    );
  });

  it("saves with amount override when provided", async () => {
    upsertSeasonAwardMock.mockResolvedValue("award-1");

    render(<SeasonAwardsManager />);

    fireEvent.change(screen.getByLabelText("Member"), {
      target: { value: "u1" },
    });

    fireEvent.change(screen.getByPlaceholderText(/Default: \$50/i), {
      target: { value: "75" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add award/i }));

    await waitFor(() => {
      expect(upsertSeasonAwardMock).toHaveBeenCalledTimes(1);
    });

    const payload = upsertSeasonAwardMock.mock.calls[0][0];
    expect(payload.userId).toBe("u1");
    expect(payload.userDisplayName).toBe("Alice Member");
    expect(payload.awardType).toBe(SeasonAwardType.HoleInOne);
    expect(payload.amount).toBe(75);
    expect(payload.seasonYear).toBe(new Date().getFullYear());
  });
});
