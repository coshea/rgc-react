/**
 * Pre-migration baseline: verifies ThemeSwitch renders with the correct
 * aria-label for the current theme and calls setTheme when activated.
 *
 * ThemeSwitch imports from @heroui/switch and @heroui/use-theme — individual
 * packages that have no HeroUI v3 equivalents. After migration those imports
 * will move to @heroui/react; update the mock paths below and this test should
 * still pass if the component contract is preserved.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── theme hook mock ──────────────────────────────────────────────────────────
const setThemeMock = vi.fn();
let currentTheme = "light";

vi.mock("@heroui/use-theme", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme: setThemeMock }),
}));

// ── useSwitch mock ───────────────────────────────────────────────────────────
// Provides the minimal shape ThemeSwitch destructures from useSwitch.
vi.mock("@heroui/switch", () => ({
  useSwitch: ({
    isSelected,
    onChange,
  }: {
    isSelected: boolean;
    onChange: () => void;
  }) => ({
    Component: "label" as React.ElementType,
    slots: {
      wrapper: ({ class: cls }: { class: string }) => cls ?? "",
    },
    isSelected,
    getBaseProps: ({ className }: { className?: string }) => ({ className }),
    getInputProps: () => ({
      type: "checkbox" as const,
      checked: isSelected,
      onChange,
      readOnly: false,
    }),
    getWrapperProps: () => ({}),
  }),
}));

// ── icons mock ────────────────────────────────────────────────────────────────
vi.mock("@/components/icons", () => ({
  SunFilledIcon: () => <span data-testid="sun-icon" />,
  MoonFilledIcon: () => <span data-testid="moon-icon" />,
}));

import React from "react";
import { ThemeSwitch } from "@/components/theme-switch";

describe("ThemeSwitch", () => {
  beforeEach(() => {
    setThemeMock.mockClear();
    currentTheme = "light";
  });

  it("renders 'Switch to dark mode' aria-label when theme is light", async () => {
    currentTheme = "light";
    render(<ThemeSwitch />);
    // isMounted guard: wait for the useEffect to flip isMounted to true
    await act(async () => {});

    expect(screen.getByRole("checkbox", { hidden: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Switch to dark mode")).toBeInTheDocument();
  });

  it("renders 'Switch to light mode' aria-label when theme is dark", async () => {
    currentTheme = "dark";
    render(<ThemeSwitch />);
    await act(async () => {});

    expect(screen.getByLabelText("Switch to light mode")).toBeInTheDocument();
  });

  it("shows sun icon when in dark mode (selecting = switching to light)", async () => {
    currentTheme = "dark";
    render(<ThemeSwitch />);
    await act(async () => {});

    expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("moon-icon")).not.toBeInTheDocument();
  });

  it("shows moon icon when in light mode (selecting = switching to dark)", async () => {
    currentTheme = "light";
    render(<ThemeSwitch />);
    await act(async () => {});

    expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("sun-icon")).not.toBeInTheDocument();
  });

  it("calls setTheme with 'dark' when toggled from light", async () => {
    currentTheme = "light";
    render(<ThemeSwitch />);
    await act(async () => {});

    const checkbox = screen.getByRole("checkbox", { hidden: true });
    fireEvent.click(checkbox);

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with 'light' when toggled from dark", async () => {
    currentTheme = "dark";
    render(<ThemeSwitch />);
    await act(async () => {});

    const checkbox = screen.getByRole("checkbox", { hidden: true });
    fireEvent.click(checkbox);

    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
