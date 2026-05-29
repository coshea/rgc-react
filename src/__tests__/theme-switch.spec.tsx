/**
 * ThemeSwitch unit tests.
 *
 * The component uses Switch and useTheme from @heroui/react (v3).
 * We mock useTheme to control the current theme in tests, and mock
 * the icons to use data-testid for querying.
 *
 * HeroUI v3 Switch renders as role="switch", not role="checkbox".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const setThemeMock = vi.fn();
let currentTheme = "light";

// Mock useTheme from the package the component actually uses
vi.mock("@heroui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@heroui/react")>();
  return {
    ...actual,
    useTheme: () => ({ theme: currentTheme, setTheme: setThemeMock }),
  };
});

// ── icons mock ───────────────────────────────────────────────────────────────
vi.mock("@/components/icons", () => ({
  SunFilledIcon: () => <span data-testid="sun-icon" />,
  MoonFilledIcon: () => <span data-testid="moon-icon" />,
}));

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

    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument();
  });

  it("renders 'Switch to light mode' aria-label when theme is dark", async () => {
    currentTheme = "dark";
    render(<ThemeSwitch />);
    await act(async () => {});

    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
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

    const switchEl = screen.getByRole("button");
    fireEvent.click(switchEl);

    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with 'light' when toggled from dark", async () => {
    currentTheme = "dark";
    render(<ThemeSwitch />);
    await act(async () => {});

    const switchEl = screen.getByRole("button");
    fireEvent.click(switchEl);

    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
